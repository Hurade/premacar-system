import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { contactId, campaignId, message } = await req.json()

    // 1. Buscar settings
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_enabled, elevenlabs_api_key_integration, elevenlabs_voice_id_integration, elevenlabs_enabled')
      .limit(1).single()

    if (!settings?.twilio_enabled || !settings?.twilio_account_sid) {
      return new Response(JSON.stringify({ success: false, error: 'Twilio não configurado' }), { status: 400, headers: corsHeaders })
    }
    if (!settings?.elevenlabs_enabled || !settings?.elevenlabs_api_key_integration) {
      return new Response(JSON.stringify({ success: false, error: 'ElevenLabs não configurado' }), { status: 400, headers: corsHeaders })
    }

    // 2. Buscar contato
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone_number, name, call_name')
      .eq('id', contactId).single()

    if (!contact) {
      return new Response(JSON.stringify({ success: false, error: 'Contato não encontrado' }), { status: 404, headers: corsHeaders })
    }

    // 3. Personalizar mensagem com nome
    const contactName = contact.name || contact.call_name || 'Cliente'
    const personalizedMessage = message.replace(/\{\{nome\}\}/g, contactName)

    // 4. Gerar áudio via ElevenLabs
    const voiceId = settings.elevenlabs_voice_id_integration || 'EXAVITQu4vr4xnSDxMaL'
    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': settings.elevenlabs_api_key_integration
        },
        body: JSON.stringify({
          text: personalizedMessage,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.80,
            style: 0.30,
            use_speaker_boost: true
          }
        })
      }
    )

    if (!ttsResp.ok) {
      const errText = await ttsResp.text()
      console.error('[make-voice-call] ElevenLabs error status:', ttsResp.status)
      console.error('[make-voice-call] ElevenLabs error body:', errText)
      console.error('[make-voice-call] Voice ID used:', voiceId)
      console.error('[make-voice-call] Message length:', personalizedMessage.length)
      return new Response(
        JSON.stringify({
          success: false,
          error: `ElevenLabs ${ttsResp.status}: ${errText.substring(0, 500)}`,
          voice_id: voiceId,
          message_length: personalizedMessage.length
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    const audioBuffer = await ttsResp.arrayBuffer()

    // 5. Upload para Supabase Storage
    const fileName = `call-${contactId}-${Date.now()}.mp3`
    const { error: uploadError } = await supabase.storage
      .from('call-audios')
      .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

    if (uploadError) {
      console.error('[make-voice-call] Upload error:', uploadError)
      return new Response(JSON.stringify({ success: false, error: 'Erro ao salvar áudio' }), { status: 500, headers: corsHeaders })
    }

    const { data: publicUrl } = supabase.storage.from('call-audios').getPublicUrl(fileName)
    const audioUrl = publicUrl.publicUrl

    // 6. URL do TwiML (a função voice-call-twiml não requer JWT)
    const twimlUrl = `${supabaseUrl}/functions/v1/voice-call-twiml?audio=${encodeURIComponent(audioUrl)}&contact=${contactId}`

    // 7. Fazer ligação via Twilio
    const cleanPhone = contact.phone_number.replace(/\D/g, '')
    const toPhone = cleanPhone.startsWith('55') ? `+${cleanPhone}` : `+55${cleanPhone}`

    const twilioAuth = btoa(`${settings.twilio_account_sid}:${settings.twilio_auth_token}`)
    const callParams = new URLSearchParams({
      To: toPhone,
      From: settings.twilio_phone_number,
      Url: twimlUrl,
      StatusCallback: `${supabaseUrl}/functions/v1/voice-call-twiml?callback=status&contact=${contactId}`,
      StatusCallbackEvent: 'completed',
      StatusCallbackMethod: 'POST'
    })

    const callResp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_account_sid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: callParams.toString()
      }
    )

    const callData = await callResp.json()

    if (!callResp.ok) {
      console.error('[make-voice-call] Twilio error status:', callResp.status)
      console.error('[make-voice-call] Twilio error body:', JSON.stringify(callData))
      console.error('[make-voice-call] To phone:', toPhone)
      console.error('[make-voice-call] From phone:', settings.twilio_phone_number)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Twilio ${callResp.status}: ${callData.message || JSON.stringify(callData)}`,
          twilio_code: callData.code,
          twilio_more_info: callData.more_info,
          to_phone: toPhone
        }),
        { status: 500, headers: corsHeaders }
      )
    }

    // 8. Registrar no banco
    await supabase.from('voice_calls').insert({
      contact_id: contactId,
      campaign_id: campaignId || null,
      call_sid: callData.sid,
      status: 'initiated',
      audio_url: audioUrl
    })

    console.log('[make-voice-call] Call initiated:', callData.sid, 'to', toPhone)
    return new Response(JSON.stringify({ success: true, callSid: callData.sid }), { headers: corsHeaders })

  } catch (err: any) {
    console.error('[make-voice-call] Error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders })
  }
})
