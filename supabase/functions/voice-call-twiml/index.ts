import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { saveLog } from "../_shared/logger.ts"

// ── Textos fixos do script da Cris ───────────────────────────────────────────
const MSG_INITIAL =
  `Olá! Aqui é a Cris, da PremaCar. Somos uma plataforma que automatiza o ` +
  `pós-venda de oficinas mecânicas pelo WhatsApp, recuperando clientes inativos ` +
  `e gerando faturamento recorrente. Você tem interesse em conhecer melhor? ` +
  `Digite 1 para sim ou 2 para não.`

const MSG_INTERESTED =
  `Que ótimo! Em breve nossa equipe comercial vai entrar em contato com você. ` +
  `Tenha um ótimo dia!`

const MSG_NOT_INTERESTED =
  `Tudo bem! Obrigada pelo seu tempo. Tenha um ótimo dia!`

const MSG_TIMEOUT =
  `Não identificamos sua resposta. Obrigada pela atenção. Tchau!`

// ── Helper: escapar caracteres XML ───────────────────────────────────────────
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── Helper: gerar áudio via ElevenLabs e subir para Storage ──────────────────
// Retorna a URL pública do MP3 ou null em caso de erro (usa Twilio TTS como fallback)
async function generateElevenLabsAudio(
  text: string,
  settings: Record<string, any>,
  supabase: any
): Promise<string | null> {
  const apiKey = settings.elevenlabs_api_key
  if (!apiKey) return null

  const voiceId = settings.elevenlabs_voice_id || 'EXAVITQu4vr4xnSDxMaL'
  const modelId = settings.elevenlabs_model || 'eleven_multilingual_v2'

  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: settings.elevenlabs_stability ?? 0.5,
            similarity_boost: settings.elevenlabs_similarity_boost ?? 0.75,
            style: settings.elevenlabs_style ?? 0,
            use_speaker_boost: settings.elevenlabs_speaker_boost ?? true,
            ...(settings.elevenlabs_speed ? { speed: settings.elevenlabs_speed } : {}),
          },
        }),
      }
    )

    if (!ttsRes.ok) {
      console.error(`[voice-twiml] ElevenLabs ${ttsRes.status}: ${await ttsRes.text()}`)
      return null
    }

    const audioBuffer = await ttsRes.arrayBuffer()
    const fileName = `tts/call-${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`

    const { error: uploadError } = await supabase.storage
      .from('voice-recordings')
      .upload(fileName, audioBuffer, { contentType: 'audio/mpeg', upsert: true })

    if (uploadError) {
      console.error('[voice-twiml] Storage upload error:', uploadError.message)
      return null
    }

    const { data: urlData } = supabase.storage
      .from('voice-recordings')
      .getPublicUrl(fileName)

    console.log('[voice-twiml] ElevenLabs audio ready:', urlData.publicUrl)
    return urlData.publicUrl
  } catch (err: any) {
    console.error('[voice-twiml] ElevenLabs exception:', err.message)
    return null
  }
}

// ── Helper: retorna elemento TwiML de fala (Say ou Play) ─────────────────────
function twimlSpeak(text: string, audioUrl: string | null): string {
  if (audioUrl) {
    return `<Play>${audioUrl}</Play>`
  }
  return `<Say voice="Polly.Vitoria" language="pt-BR">${xmlEscape(text)}</Say>`
}

// ── Helper: resposta TwiML simples (sem Gather) ───────────────────────────────
function simpleResponse(text: string, audioUrl: string | null): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSpeak(text, audioUrl)}
  <Hangup/>
</Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const url = new URL(req.url)
  const contactId = url.searchParams.get('contact')
  const callback = url.searchParams.get('callback')
  const isDtmf = url.searchParams.get('dtmf') === '1'

  // ── 1. STATUS CALLBACK — ligação finalizou ───────────────────────────────
  if (callback === 'status') {
    let callSid = '', callStatus = '', duration = 0
    try {
      const fd = await req.formData()
      callSid = fd.get('CallSid') as string
      callStatus = fd.get('CallStatus') as string
      duration = parseInt(fd.get('CallDuration') as string || '0')
    } catch { /* corpo vazio */ }

    if (callSid) {
      await supabase.from('voice_calls').update({
        status: callStatus,
        duration_seconds: duration,
        updated_at: new Date().toISOString(),
      }).eq('call_sid', callSid)
    }

    await saveLog(supabase, {
      source: 'voice-call-twiml',
      level: ['failed', 'busy', 'no-answer'].includes(callStatus) ? 'warning' : 'info',
      message: `Call status: ${callStatus}`,
      metadata: { call_sid: callSid, status: callStatus, duration_seconds: duration, contact_id: contactId },
    })

    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
  }

  // Carregar nina_settings uma única vez para todos os fluxos seguintes
  const { data: settings } = await supabase
    .from('nina_settings')
    .select(
      'elevenlabs_api_key, elevenlabs_voice_id, elevenlabs_model, ' +
      'elevenlabs_stability, elevenlabs_similarity_boost, elevenlabs_speed, ' +
      'elevenlabs_style, elevenlabs_speaker_boost, ' +
      'evolution_api_url, evolution_api_key, evolution_instance_name, ' +
      'scheduling_notify_commercial, scheduling_notify_phone, scheduling_notify_evolution_instance'
    )
    .limit(1)
    .single()

  const voiceMode = settings?.elevenlabs_api_key ? 'elevenlabs' : 'twilio-tts'
  console.log(`[voice-twiml] voice_mode=${voiceMode}, contact=${contactId}, dtmf=${isDtmf}`)

  // ── 2. DTMF — lead teclou um dígito ─────────────────────────────────────
  if (isDtmf) {
    let digit = '', callSid = ''
    try {
      const fd = await req.formData()
      digit = fd.get('Digits') as string || ''
      callSid = fd.get('CallSid') as string || ''
    } catch { /* corpo vazio — timeout do Gather */ }

    await saveLog(supabase, {
      source: 'voice-call-twiml',
      level: 'info',
      message: `DTMF received: digit="${digit}"`,
      metadata: { call_sid: callSid, digit, contact_id: contactId },
    })

    if (callSid) {
      await supabase.from('voice_calls').update({
        dtmf_response: digit || 'timeout',
        updated_at: new Date().toISOString(),
      }).eq('call_sid', callSid)
    }

    // ── Dígito 1: INTERESSADO ────────────────────────────────────────────
    if (digit === '1') {
      // Processar contato em paralelo com geração de áudio
      const [audioUrl] = await Promise.all([
        generateElevenLabsAudio(MSG_INTERESTED, settings || {}, supabase),
        (async () => {
          if (!contactId) return
          const { data: contact } = await supabase
            .from('contacts')
            .select('name, phone_number, tags')
            .eq('id', contactId)
            .single()

          // Adicionar tag
          const currentTags = (contact?.tags as string[]) || []
          if (!currentTags.includes('DEMO-SOLICITADA-LIGACAO')) {
            await supabase.from('contacts')
              .update({ tags: [...currentTags, 'DEMO-SOLICITADA-LIGACAO'] })
              .eq('id', contactId)
          }

          // Notificação WhatsApp para comercial
          if (settings?.scheduling_notify_phone) {
            const evolutionUrl = settings.evolution_api_url?.replace(/\/$/, '')
            const instance = settings.scheduling_notify_evolution_instance || settings.evolution_instance_name
            const notifPhone = settings.scheduling_notify_phone.replace(/\D/g, '')
            const name = contact?.name || 'Não informado'
            const phone = contact?.phone_number || 'Não informado'
            const notifText =
              `📞 Novo interesse via ligação!\n\n` +
              `Nome: ${name}\nTelefone: ${phone}\n\n` +
              `Entre em contato para agendar demonstração.`

            try {
              await fetch(`${evolutionUrl}/message/sendText/${instance}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: settings.evolution_api_key },
                body: JSON.stringify({ number: notifPhone, text: notifText }),
              })
              console.log('[voice-twiml] Commercial notification sent')
            } catch (err: any) {
              console.error('[voice-twiml] Notification error:', err.message)
            }
          }
        })()
      ])

      return simpleResponse(MSG_INTERESTED, audioUrl)
    }

    // ── Dígito 2: NÃO INTERESSADO ────────────────────────────────────────
    if (digit === '2') {
      const [audioUrl] = await Promise.all([
        generateElevenLabsAudio(MSG_NOT_INTERESTED, settings || {}, supabase),
        (async () => {
          if (!contactId) return
          const { data: contact } = await supabase
            .from('contacts')
            .select('tags')
            .eq('id', contactId)
            .single()

          const currentTags = (contact?.tags as string[]) || []
          if (!currentTags.includes('Sem Interesse')) {
            await supabase.from('contacts')
              .update({ tags: [...currentTags, 'Sem Interesse'] })
              .eq('id', contactId)
          }
        })()
      ])

      return simpleResponse(MSG_NOT_INTERESTED, audioUrl)
    }

    // ── Sem dígito / outro dígito: TIMEOUT / INVÁLIDO ────────────────────
    const audioUrl = await generateElevenLabsAudio(MSG_TIMEOUT, settings || {}, supabase)
    return simpleResponse(MSG_TIMEOUT, audioUrl)
  }

  // ── 3. TWIML INICIAL — primeira chamada do Twilio ────────────────────────
  const dtmfWebhookUrl =
    `${supabaseUrl}/functions/v1/voice-call-twiml?dtmf=1&contact=${contactId ?? ''}`

  // Gerar áudio da mensagem inicial (apenas no Modo B)
  const initialAudioUrl = await generateElevenLabsAudio(MSG_INITIAL, settings || {}, supabase)

  // Mensagem de timeout usa Twilio TTS mesmo no Modo B para evitar latência extra
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="${dtmfWebhookUrl}" method="POST" numDigits="1" timeout="10">
    ${twimlSpeak(MSG_INITIAL, initialAudioUrl)}
    <Pause length="1"/>
  </Gather>
  ${twimlSpeak(MSG_TIMEOUT, null)}
  <Hangup/>
</Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
})
