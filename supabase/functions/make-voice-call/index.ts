import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { saveLog } from "../_shared/logger.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SOURCE = 'make-voice-call'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const { contactId, campaignId, message } = await req.json()

    // LOG 1: Call initiated
    await saveLog(supabase, {
      source: SOURCE,
      level: 'info',
      message: 'Call initiated',
      metadata: { contactId, campaignId: campaignId || null }
    })

    // 1. Buscar settings
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_enabled, elevenlabs_api_key_integration, elevenlabs_voice_id_integration, elevenlabs_enabled')
      .limit(1).single()

    if (!settings?.twilio_enabled || !settings?.twilio_account_sid) {
      await saveLog(supabase, { source: SOURCE, level: 'error', message: 'Twilio not configured', metadata: { contactId } })
      return new Response(JSON.stringify({ success: false, error: 'Twilio não configurado' }), { status: 400, headers: corsHeaders })
    }
    if (!settings?.elevenlabs_enabled || !settings?.elevenlabs_api_key_integration) {
      await saveLog(supabase, { source: SOURCE, level: 'error', message: 'ElevenLabs not configured', metadata: { contactId } })
      return new Response(JSON.stringify({ success: false, error: 'ElevenLabs não configurado' }), { status: 400, headers: corsHeaders })
    }

    // 2. Buscar contato
    const { data: contact } = await supabase
      .from('contacts')
      .select('phone_number, name, call_name')
      .eq('id', contactId).single()

    if (!contact) {
      await saveLog(supabase, { source: SOURCE, level: 'error', message: 'Contact not found', metadata: { contactId } })
      return new Response(JSON.stringify({ success: false, error: 'Contato não encontrado' }), { status: 404, headers: corsHeaders })
    }

    // 3. Personalizar mensagem com nome
    const contactName = contact.name || contact.call_name || 'Cliente'
    const personalizedMessage = message.replace(/\{\{nome\}\}/g, contactName)

    // 4. Gerar áudio via ElevenLabs
    const voiceId = settings.elevenlabs_voice_id_integration || 'EXAVITQu4vr4xnSDxMaL'

    // LOG 2: Calling ElevenLabs
    await saveLog(supabase, {
      source: SOURCE,
      level: 'info',
      message: 'Calling ElevenLabs',
      metadata: { voice_id: voiceId, message_length: personalizedMessage.length, contactId }
    })

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

      // LOG 3: ElevenLabs error
      await saveLog(supabase, {
        source: SOURCE,
        level: 'error',
        message: 'ElevenLabs error',
        metadata: {
          status_code: ttsResp.status,
          response_body: errText.substring(0, 1000),
          voice_id: voiceId,
          contactId
        }
      })

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
      await saveLog(supabase, {
        source: SOURCE,
        level: 'error',
        message: 'Upload error',
        metadata: { error: uploadError.message, contactId }
      })
      return new Response(JSON.stringify({ success: false, error: 'Erro ao salvar áudio' }), { status: 500, headers: corsHeaders })
    }

    const { data: publicUrl } = supabase.storage.from('call-audios').getPublicUrl(fileName)
    const audioUrl = publicUrl.publicUrl

    // 6. URL do TwiML (a função voice-call-twiml não requer JWT)
    const twimlUrl = `${supabaseUrl}/functions/v1/voice-call-twiml?audio=${encodeURIComponent(audioUrl)}&contact=${contactId}`

    // 7. Fazer ligação via Twilio
    const cleanPhone = contact.phone_number.replace(/\D/g, '')
    const toPhone = cleanPhone.startsWith('55') ? `+${cleanPhone}` : `+55${cleanPhone}`

    // LOG 4: Calling Twilio
    await saveLog(supabase, {
      source: SOURCE,
      level: 'info',
      message: 'Calling Twilio',
      metadata: { to_phone: toPhone, from_phone: settings.twilio_phone_number, contactId }
    })

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

      // LOG 5: Twilio error
      await saveLog(supabase, {
        source: SOURCE,
        level: 'error',
        message: 'Twilio error',
        metadata: {
          status_code: callResp.status,
          response_body: callData,
          to_phone: toPhone,
          contactId
        }
      })

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

    // LOG 6: Call created
    await saveLog(supabase, {
      source: SOURCE,
      level: 'info',
      message: 'Call created',
      metadata: { call_sid: callData.sid, to_phone: toPhone, contactId }
    })

    console.log('[make-voice-call] Call initiated:', callData.sid, 'to', toPhone)
    return new Response(JSON.stringify({ success: true, callSid: callData.sid }), { headers: corsHeaders })

  } catch (err: any) {
    console.error('[make-voice-call] Error:', err)
    await saveLog(supabase, {
      source: SOURCE,
      level: 'error',
      message: 'Unhandled error',
      metadata: { error: err?.message || String(err) }
    })
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders })
  }
})
