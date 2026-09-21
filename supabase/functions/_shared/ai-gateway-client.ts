// Cliente para o AI Gateway próprio (self-hosted no mesmo servidor EasyPanel
// da Evolution API) — mesmo padrão usado nos outros projetos Python do
// usuário (client/ai_gateway_client.py), portado pra Deno. Substitui o
// gateway do Lovable (ai.gateway.lovable.dev + LOVABLE_API_KEY) nas funções
// que fazem UMA extração estruturada por chamada (pedem um JSON específico
// de volta) — não serve para o orquestrador principal (nina-orchestrator),
// que precisa de múltiplas tools com escolha livre do modelo + resposta em
// texto solto, algo que este gateway não expõe (contrato exige exatamente
// uma tool por chamada).

export type GatewayContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

export interface GatewayMessage {
  role: 'user' | 'assistant';
  content: string | GatewayContentBlock[];
}

export interface GatewayToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CompleteParams {
  system: string;
  messages: GatewayMessage[];
  tool: GatewayToolSchema;
}

function getConfig(): { url: string; secret: string } {
  const url = Deno.env.get('AI_GATEWAY_URL');
  const secret = Deno.env.get('AI_GATEWAY_SECRET');
  if (!url || !secret) {
    throw new Error('AI_GATEWAY_URL/AI_GATEWAY_SECRET não configurados');
  }
  return { url: url.replace(/\/$/, ''), secret };
}

// Espelha `complete()` do client Python: manda system/tool/messages, devolve
// direto o dict que a IA preencheu pra tool (tool_input) — já validado
// contra o input_schema do lado do gateway.
export async function complete<T = Record<string, unknown>>(params: CompleteParams): Promise<T> {
  const { url, secret } = getConfig();

  const response = await fetch(`${url}/v1/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-gateway-secret': secret,
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Gateway error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  if (!data || typeof data.tool_input === 'undefined') {
    throw new Error('AI Gateway: resposta sem tool_input');
  }
  return data.tool_input as T;
}

export interface TranscribeParams {
  audio_base64: string;
  mime_type: string;
  language?: string;
}

export async function transcribe(params: TranscribeParams): Promise<Record<string, string>> {
  const { url, secret } = getConfig();

  const response = await fetch(`${url}/v1/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-gateway-secret': secret,
    },
    body: JSON.stringify({ language: 'pt', ...params }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Gateway error: ${response.status} ${errText}`);
  }

  return response.json();
}
