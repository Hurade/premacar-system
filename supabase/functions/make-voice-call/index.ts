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
    const { contactId, campaignId, message, callType, initiatedBy } = await req.json()
    const resolvedMessage = message || 'Olá, esta é uma ligação da PremaCar.'

    // LOG 1: Call initiated
    await saveLog(supabase, {
      source: SOURCE,
      level: 'info',
      message: 'Call initiated',
      metadata: { contactId, campaignId: campaignId || null }
    })

    // 1. Buscar settings (apenas Twilio - usando TTS nativo)
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('twilio_account_sid, twilio_auth_token, twilio_phone_number, twilio_enabled')
      .limit(1).single()

    // LOG 2: Settings loaded
    await saveLog(supabase, {
      source: SOURCE,
      level: 'info',
      message: 'Settings loaded',
      metadata: {
        has_twilio: !!(settings?.twilio_enabled && settings?.twilio_account_sid),
        twilio_phone: settings?.twilio_phone_number || null
      }
    })

    if (!settings?.twilio_enabled || !settings?.twilio_account_sid) {
      const detail = !settings?.twilio_enabled
        ? 'Twilio desabilitado — ative em Configurações → Integrações → Twilio'
        : 'Twilio Account SID não preenchido em Configurações → Integrações → Twilio';
      await saveLog(supabase, { source: SOURCE, level: 'error', message: detail, metadata: { contactId, twilio_enabled: settings?.twilio_enabled, has_sid: !!settings?.twilio_account_sid } })
      return new Response(JSON.stringify({ success: false, error: detail }), { status: 400, headers: corsHeaders })
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
    const personalizedMessage = resolvedMessage.replace(/\{\{nome\}\}/g, contactName)

    // 4. URL do TwiML — passa mensagem direto via query param (TTS no Twilio)
    const twimlUrl = `${supabaseUrl}/functions/v1/voice-call-twiml?message=${encodeURIComponent(personalizedMessage)}&contact=${contactId}`

    // 5. Fazer ligação via Twilio
    const cleanPhone = contact.phone_number.replace(/\D/g, '')
    const toPhone = cleanPhone.startsWith('55') ? `+${cleanPhone}` : `+55${cleanPhone}`

    // LOG 4: Calling Twilio
    await saveLog(supabase, {
      source: SOURCE,
      level: 'info',
      message: 'Calling Twilio',
      metadata: { to_phone: toPhone, from_phone: settings.twilio_phone_number, contactId, message_length: personalizedMessage.length }
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

    // 6. Registrar no banco (sem audio_url — TTS é renderizado pelo Twilio)
    await supabase.from('voice_calls').insert({
      contact_id: contactId,
      campaign_id: campaignId || null,
      call_sid: callData.sid,
      status: 'initiated',
      call_type: callType === 'manual' ? 'manual' : 'campaign',
      initiated_by: initiatedBy || null
    })

    // LOG 6: Call created
    await saveLog(supabase, {
      source: SOURCE,
      level: 'info',
      message: 'Call created',
      metadata: { status: callResp.status, call_sid: callData.sid, to_phone: toPhone, contactId }
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
