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

// TwiML mínimo para retornar quando ocorre qualquer erro grave
const TWIML_ERROR_FALLBACK = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Vitoria" language="pt-BR">Olá! No momento não conseguimos processar sua chamada. Tente novamente em breve.</Say>
  <Hangup/>
</Response>`

const XML_HEADERS = { 'Content-Type': 'text/xml' }

// ── Helper: escapar caracteres XML ───────────────────────────────────────────
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

// ── Helper: gerar áudio ElevenLabs → Supabase Storage → URL pública ──────────
// Retorna null silenciosamente em caso de erro — usa Twilio TTS como fallback
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
      console.error(`[voice-twiml] ElevenLabs ${ttsRes.status}:`, await ttsRes.text())
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

// ── Helper: elemento TwiML de fala (Say ou Play) ─────────────────────────────
function twimlSpeak(text: string, audioUrl: string | null): string {
  if (audioUrl) return `<Play>${audioUrl}</Play>`
  return `<Say voice="Polly.Vitoria" language="pt-BR">${xmlEscape(text)}</Say>`
}

// ── Helper: resposta TwiML simples (fala + hangup) ────────────────────────────
function simpleResponse(text: string, audioUrl: string | null): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${twimlSpeak(text, audioUrl)}
  <Hangup/>
</Response>`,
    { headers: XML_HEADERS }
  )
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  // Log imediato — antes de qualquer operação assíncrona
  // Aparece nos logs do Supabase Dashboard → Edge Functions → voice-call-twiml
  console.log(`[voice-twiml] ▶ ${req.method} ${req.url}`)

  // Fallback global: qualquer erro não tratado retorna TwiML válido para o Twilio
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    // Variáveis de ambiente obrigatórias
    if (!supabaseUrl || !serviceKey) {
      console.error('[voice-twiml] FATAL: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente')
      return new Response(TWIML_ERROR_FALLBACK, { headers: XML_HEADERS })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    const url = new URL(req.url)
    const contactId = url.searchParams.get('contact') || null
    const callback = url.searchParams.get('callback')
    const isDtmf = url.searchParams.get('dtmf') === '1'

    // ── 1. STATUS CALLBACK — ligação finalizou ─────────────────────────────
    if (callback === 'status') {
      let callSid = '', callStatus = '', duration = 0
      try {
        const fd = await req.formData()
        callSid = (fd.get('CallSid') as string) || ''
        callStatus = (fd.get('CallStatus') as string) || ''
        duration = parseInt((fd.get('CallDuration') as string) || '0')
      } catch { /* body vazio ou formato inesperado */ }

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

      return new Response('<Response/>', { headers: XML_HEADERS })
    }

    // Carregar nina_settings — maybeSingle() não lança erro se a tabela estiver vazia
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
      .maybeSingle()  // ← era .single() — lançava erro quando sem linhas

    const s = settings || {}  // nunca null depois daqui
    const voiceMode = s.elevenlabs_api_key ? 'elevenlabs' : 'twilio-tts'
    console.log(`[voice-twiml] voice_mode=${voiceMode}, contact=${contactId}, dtmf=${isDtmf}`)

    // ── 2. DTMF — lead teclou um dígito ───────────────────────────────────
    if (isDtmf) {
      let digit = '', callSid = ''
      try {
        const fd = await req.formData()
        digit = (fd.get('Digits') as string) || ''
        callSid = (fd.get('CallSid') as string) || ''
      } catch { /* timeout do Gather — Twilio chama action sem body */ }

      console.log(`[voice-twiml] DTMF: digit="${digit}", callSid="${callSid}", contact="${contactId}"`)

      await saveLog(supabase, {
        source: 'voice-call-twiml',
        level: 'info',
        message: `DTMF received: digit="${digit || 'none'}"`,
        metadata: { call_sid: callSid, digit: digit || null, contact_id: contactId },
      })

      if (callSid) {
        await supabase.from('voice_calls').update({
          dtmf_response: digit || 'timeout',
          updated_at: new Date().toISOString(),
        }).eq('call_sid', callSid)
      }

      // ── Dígito 1: INTERESSADO ──────────────────────────────────────────
      if (digit === '1') {
        // Gera áudio e processa contato em paralelo.
        // A IIFE tem try/catch próprio — nunca rejeita o Promise.all.
        const [audioUrl] = await Promise.all([
          generateElevenLabsAudio(MSG_INTERESTED, s, supabase),
          (async () => {
            try {
              if (!contactId) return

              const { data: contact } = await supabase
                .from('contacts')
                .select('name, phone_number, tags')
                .eq('id', contactId)
                .maybeSingle()

              // Adicionar tag
              const currentTags = (contact?.tags as string[]) || []
              if (!currentTags.includes('DEMO-SOLICITADA-LIGACAO')) {
                await supabase.from('contacts')
                  .update({ tags: [...currentTags, 'DEMO-SOLICITADA-LIGACAO'] })
                  .eq('id', contactId)
              }

              // Notificação WhatsApp para comercial
              const notifyPhone = s.scheduling_notify_phone
              if (notifyPhone && s.evolution_api_url && s.evolution_api_key && s.evolution_instance_name) {
                const evolutionBase = s.evolution_api_url.replace(/\/$/, '')
                const instance = s.scheduling_notify_evolution_instance || s.evolution_instance_name
                const cleanNotifyPhone = notifyPhone.replace(/\D/g, '')
                const name = contact?.name || 'Não informado'
                const phone = contact?.phone_number || 'Não informado'
                const notifText =
                  `📞 Novo interesse via ligação!\n\n` +
                  `Nome: ${name}\nTelefone: ${phone}\n\n` +
                  `Entre em contato para agendar demonstração.`

                await fetch(`${evolutionBase}/message/sendText/${instance}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', apikey: s.evolution_api_key },
                  body: JSON.stringify({ number: cleanNotifyPhone, text: notifText }),
                })
                console.log('[voice-twiml] Commercial notification sent to', cleanNotifyPhone)
              }
            } catch (err: any) {
              // Nunca propaga — processamento do contato não pode quebrar a resposta TwiML
              console.error('[voice-twiml] Contact processing error (digit 1):', err.message)
            }
          })(),
        ])

        return simpleResponse(MSG_INTERESTED, audioUrl)
      }

      // ── Dígito 2: NÃO INTERESSADO ────────────────────────────────────
      if (digit === '2') {
        const [audioUrl] = await Promise.all([
          generateElevenLabsAudio(MSG_NOT_INTERESTED, s, supabase),
          (async () => {
            try {
              if (!contactId) return
              const { data: contact } = await supabase
                .from('contacts')
                .select('tags')
                .eq('id', contactId)
                .maybeSingle()

              const currentTags = (contact?.tags as string[]) || []
              if (!currentTags.includes('Sem Interesse')) {
                await supabase.from('contacts')
                  .update({ tags: [...currentTags, 'Sem Interesse'] })
                  .eq('id', contactId)
              }
            } catch (err: any) {
              console.error('[voice-twiml] Contact processing error (digit 2):', err.message)
            }
          })(),
        ])

        return simpleResponse(MSG_NOT_INTERESTED, audioUrl)
      }

      // ── Sem dígito / dígito inválido ────────────────────────────────
      const audioUrl = await generateElevenLabsAudio(MSG_TIMEOUT, s, supabase)
      return simpleResponse(MSG_TIMEOUT, audioUrl)
    }

    // ── 3. TWIML INICIAL — primeira chamada do Twilio ──────────────────────
    // IMPORTANTE: o & entre parâmetros da query string DEVE ser &amp; dentro de
    // atributos XML. O Twilio parseia TwiML como XML — & não escapado = XML inválido
    // = "I'm sorry, an application error has occurred".
    const dtmfWebhookUrl =
      `${supabaseUrl}/functions/v1/voice-call-twiml?dtmf=1&amp;contact=${contactId ?? ''}`

    console.log(`[voice-twiml] TwiML inicial: dtmfUrl="${dtmfWebhookUrl}", voiceMode=${voiceMode}`)

    // Modo B: gera áudio ElevenLabs para a mensagem inicial
    // Timeout fora do Gather usa sempre Twilio TTS (evita latência extra na chamada inicial)
    const initialAudioUrl = await generateElevenLabsAudio(MSG_INITIAL, s, supabase)

    await saveLog(supabase, {
      source: 'voice-call-twiml',
      level: 'info',
      message: `TwiML inicial gerado: voice_mode=${voiceMode}, contact=${contactId}`,
      metadata: { contact_id: contactId, voice_mode: voiceMode, has_audio_url: !!initialAudioUrl },
    })

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
      { headers: XML_HEADERS }
    )

  } catch (err: any) {
    // Exceção não esperada — loga stack completo e retorna TwiML mínimo para o Twilio não quebrar
    console.error('[voice-twiml] ❌ UNHANDLED ERROR:', err?.message || String(err))
    console.error('[voice-twiml] Stack:', err?.stack || '(sem stack)')
    return new Response(TWIML_ERROR_FALLBACK, { headers: XML_HEADERS })
  }
})
