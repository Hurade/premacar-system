import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const url = new URL(req.url)
  const contactId = url.searchParams.get('contact')
  const audioUrl = url.searchParams.get('audio')
  const callback = url.searchParams.get('callback')

  // STATUS CALLBACK — chamada finalizou
  if (callback === 'status') {
    const formData = await req.formData()
    const callSid = formData.get('CallSid') as string
    const callStatus = formData.get('CallStatus') as string
    const duration = parseInt(formData.get('CallDuration') as string || '0')

    await supabase.from('voice_calls').update({
      status: callStatus,
      duration_seconds: duration,
      updated_at: new Date().toISOString()
    }).eq('call_sid', callSid)

    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
  }

  // DTMF RESPONSE — lead teclou algo
  if (url.searchParams.get('dtmf')) {
    const formData = await req.formData()
    const digit = formData.get('Digits') as string
    const callSid = formData.get('CallSid') as string

    await supabase.from('voice_calls').update({
      dtmf_response: digit,
      updated_at: new Date().toISOString()
    }).eq('call_sid', callSid)

    if (digit === '1' && contactId) {
      const { data: contact } = await supabase
        .from('contacts')
        .select('name, phone_number, tags')
        .eq('id', contactId).single()

      // Adicionar tag DEMO-SOLICITADA-LIGACAO
      const currentTags = contact?.tags || []
      if (!currentTags.includes('DEMO-SOLICITADA-LIGACAO')) {
        await supabase.from('contacts')
          .update({ tags: [...currentTags, 'DEMO-SOLICITADA-LIGACAO'] })
          .eq('id', contactId)
      }

      // Notificar comercial via WhatsApp
      const { data: settings } = await supabase
        .from('nina_settings')
        .select('scheduling_notify_commercial, scheduling_notify_phone, evolution_api_url, evolution_api_key, evolution_instance_name, scheduling_notify_evolution_instance')
        .limit(1).single()

      if (settings?.scheduling_notify_commercial && settings?.scheduling_notify_phone) {
        const instance = settings.scheduling_notify_evolution_instance || settings.evolution_instance_name
        const notifMessage = `🔔 *Lead interessado via ligação*\n\n👤 *Nome:* ${contact?.name || 'Sem nome'}\n📱 *Telefone:* ${contact?.phone_number}\n\n✅ O lead teclou 1 durante a ligação automática (demonstrou interesse).\n\n👉 Entre em contato via WhatsApp para agendar a demo.`

        try {
          await fetch(
            `${settings.evolution_api_url}/message/sendText/${instance}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'apikey': settings.evolution_api_key },
              body: JSON.stringify({
                number: settings.scheduling_notify_phone.replace(/\D/g, ''),
                text: notifMessage
              })
            }
          )
        } catch (err) {
          console.error('[voice-twiml] Notification error:', err)
        }
      }

      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">Ótimo! Nossa equipe vai entrar em contato com você em breve pelo WhatsApp. Obrigada e até logo!</Say>
  <Hangup/>
</Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      )
    }

    // Lead não interessado ou teclou qualquer outra coisa
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="pt-BR">Tudo bem! Obrigada pela atenção e tenha um ótimo dia.</Say>
  <Hangup/>
</Response>`,
      { headers: { 'Content-Type': 'text/xml' } }
    )
  }

  // TwiML inicial — toca áudio e coleta DTMF
  const dtmfUrl = `${supabaseUrl}/functions/v1/voice-call-twiml?dtmf=1&contact=${contactId}`

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${dtmfUrl}" method="POST" numDigits="1" timeout="10">
    <Play>${audioUrl}</Play>
    <Pause length="1"/>
    <Say voice="alice" language="pt-BR">Se você tem interesse em agendar uma demonstração, tecle 1 agora. Caso contrário, tecle 2 ou aguarde.</Say>
    <Pause length="5"/>
  </Gather>
  <Say voice="alice" language="pt-BR">Obrigada pela atenção. Tenha um ótimo dia!</Say>
  <Hangup/>
</Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
})
