// Módulo compartilhado de resolução de mídia do WhatsApp (áudio/imagem/documento).
// Consolida lógica que antes existia duplicada em message-grouper e nina-orchestrator.

export interface MediaSettings {
  meta_access_token?: string | null;
  evolution_api_url?: string | null;
  evolution_api_key?: string | null;
  evolution_instance_name?: string | null;
}

const LOVABLE_TRANSCRIBE_URL = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const LOVABLE_CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB — evita payload/latência excessiva no gateway

export interface DownloadedMedia {
  buffer: ArrayBuffer;
  contentType: string | null;
}

// Baixa mídia da API oficial da Meta (mediaId = message.<tipo>.id) com fallback
// para a Evolution API (mediaId = whatsapp_message_id da mensagem original).
// Retorna também o content-type quando disponível (usado pelo media-proxy).
export async function downloadMediaWithType(settings: MediaSettings, mediaId: string): Promise<DownloadedMedia | null> {
  if (settings?.meta_access_token) {
    try {
      const mediaResp = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
        headers: { 'Authorization': `Bearer ${settings.meta_access_token}` },
      });
      if (mediaResp.ok) {
        const mediaData = await mediaResp.json();
        if (mediaData.url) {
          const resp = await fetch(mediaData.url, {
            headers: { 'Authorization': `Bearer ${settings.meta_access_token}` },
          });
          if (resp.ok) {
            return {
              buffer: await resp.arrayBuffer(),
              contentType: resp.headers.get('content-type'),
            };
          }
        }
      }
    } catch (err) {
      console.error('[Media] Meta download failed:', err);
    }
  }

  if (settings?.evolution_api_url && settings?.evolution_api_key && settings?.evolution_instance_name) {
    try {
      const resp = await fetch(
        `${settings.evolution_api_url}/chat/getBase64FromMediaMessage/${settings.evolution_instance_name}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': settings.evolution_api_key },
          body: JSON.stringify({ message: { key: { id: mediaId } } }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        if (data.base64) {
          const binaryStr = atob(data.base64);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          return {
            buffer: bytes.buffer,
            contentType: data.mimetype || null,
          };
        }
      }
    } catch (err) {
      console.error('[Media] Evolution download failed:', err);
    }
  }

  return null;
}

// Variante simplificada (só o buffer) para quem não precisa do content-type,
// como a transcrição de áudio e a análise de imagem/documento pela IA.
export async function downloadMedia(settings: MediaSettings, mediaId: string): Promise<ArrayBuffer | null> {
  const result = await downloadMediaWithType(settings, mediaId);
  return result?.buffer ?? null;
}

// Transcreve áudio no Lovable AI Gateway.
// Modelo "whisper-1" não é mais aceito pelo gateway (catálogo de modelos
// mudou) — usa openai/gpt-4o-mini-transcribe, um dos modelos de
// transcrição atualmente suportados.
export async function transcribeAudio(audioBuffer: ArrayBuffer, lovableApiKey: string): Promise<string | null> {
  try {
    console.log('[Media] Transcribing audio, size:', audioBuffer.byteLength, 'bytes');

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
    formData.append('model', 'openai/gpt-4o-mini-transcribe');
    formData.append('language', 'pt');

    const response = await fetch(LOVABLE_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${lovableApiKey}` },
      body: formData,
    });

    if (!response.ok) {
      console.error('[Media] Transcription error:', response.status, await response.text());
      return null;
    }

    const result = await response.json();
    return result.text || null;
  } catch (err) {
    console.error('[Media] Error transcribing audio:', err);
    return null;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Analisa uma imagem via Gemini (visão nativa) no Lovable AI Gateway, retornando
// uma descrição curta em PT-BR focada em contexto comercial automotivo.
export async function describeImage(
  imageBuffer: ArrayBuffer,
  contentType: string,
  lovableApiKey: string,
  caption?: string
): Promise<string | null> {
  if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
    console.warn('[Media] Image too large, skipping analysis:', imageBuffer.byteLength);
    return null;
  }

  const dataUrl = `data:${contentType || 'image/jpeg'};base64,${arrayBufferToBase64(imageBuffer)}`;

  try {
    const response = await fetch(LOVABLE_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Descreva a imagem de forma objetiva e curta (máximo 3-4 frases), em português, focando em qualquer informação relevante para um atendimento comercial de pós-venda automotivo: placas, peças, defeitos visíveis, comprovantes, documentos, texto legível.',
          },
          {
            role: 'user',
            content: [
              ...(caption ? [{ type: 'text', text: caption }] : []),
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (response.status === 429 || response.status === 402) {
      console.error('[Media] Gemini rate/credit limit reached:', response.status);
      return null;
    }

    if (!response.ok) {
      console.error('[Media] describeImage error:', response.status, await response.text());
      return null;
    }

    const result = await response.json();
    const description = result.choices?.[0]?.message?.content?.trim();
    console.log('[Media] Image description:', description?.substring(0, 100));
    return description || null;
  } catch (err) {
    console.error('[Media] describeImage exception:', err);
    return null;
  }
}

// Extrai texto de um PDF. Retorna null se o PDF não tiver texto extraível
// (ex.: escaneado como imagem) ou se o parsing falhar.
export async function extractPdfText(buffer: ArrayBuffer): Promise<string | null> {
  try {
    const { extractText, getDocumentProxy } = await import('https://esm.sh/unpdf@0.11.0');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    const trimmed = typeof text === 'string' ? text.trim() : '';
    return trimmed.length > 0 ? trimmed : null;
  } catch (err) {
    console.error('[Media] extractPdfText error:', err);
    return null;
  }
}
