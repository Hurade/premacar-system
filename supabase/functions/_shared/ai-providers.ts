// Adapter de provedor de IA — substitui o gateway Lovable/Gemini hardcoded
// por um contrato genérico (agent_configs.ai_provider_id → ai_providers),
// suportando qualquer provedor OpenAI-compatible (OpenAI, Gemini via
// endpoint OpenAI-compat, o próprio gateway Lovable, Groq, etc.) e a
// Anthropic Messages API (formato de request/response diferente).
//
// O modo "adaptive" (heurística de qual modelo/temperatura usar conforme o
// conteúdo da mensagem) continua existindo como COMPORTAMENTO, não como
// provider fixo: escolhe entre o fast_model/smart_model do provider
// selecionado, em vez de escolher entre gemini-flash/gemini-pro fixos.

export interface AIProviderRow {
  id: string;
  name: string;
  kind: 'openai_compatible' | 'anthropic';
  base_url: string;
  api_key_secret_name: string;
  fast_model: string;
  smart_model: string;
  premium_model: string | null;
}

export interface AIProviderMessage {
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
}

export interface AIProviderCallResult {
  content: string;
  toolCalls: { id: string; function: { name: string; arguments: string } }[];
  rawAssistantMessage: any; // no formato OpenAI-compatible, para reencaminhar em follow-ups
}

export async function callAIProvider(
  provider: AIProviderRow,
  opts: {
    systemPrompt: string;
    messages: AIProviderMessage[];
    tools?: any[];
    model: string;
    temperature: number;
    maxTokens?: number;
  }
): Promise<AIProviderCallResult> {
  const apiKey = Deno.env.get(provider.api_key_secret_name);
  if (!apiKey) {
    throw new Error(`Secret ausente: ${provider.api_key_secret_name} (provider "${provider.name}")`);
  }

  if (provider.kind === 'anthropic') {
    return callAnthropic(provider, apiKey, opts);
  }
  return callOpenAICompatible(provider, apiKey, opts);
}

async function callOpenAICompatible(
  provider: AIProviderRow,
  apiKey: string,
  opts: { systemPrompt: string; messages: AIProviderMessage[]; tools?: any[]; model: string; temperature: number; maxTokens?: number }
): Promise<AIProviderCallResult> {
  const body: any = {
    model: opts.model,
    messages: [{ role: 'system', content: opts.systemPrompt }, ...opts.messages],
    temperature: opts.temperature,
    max_tokens: opts.maxTokens ?? 1000,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = 'auto';
  }

  const response = await fetch(provider.base_url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error('Rate limit exceeded, will retry later');
    if (response.status === 402) throw new Error('Payment required - please add credits');
    throw new Error(`AI error (${provider.name}): ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message;
  return {
    content: message?.content || '',
    toolCalls: message?.tool_calls || [],
    rawAssistantMessage: message,
  };
}

async function callAnthropic(
  provider: AIProviderRow,
  apiKey: string,
  opts: { systemPrompt: string; messages: AIProviderMessage[]; tools?: any[]; model: string; temperature: number; maxTokens?: number }
): Promise<AIProviderCallResult> {
  const anthropicTools = (opts.tools || []).map((t: any) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));

  // Anthropic não tem role "tool" — resultado de tool_use volta como
  // role "user" com um bloco tool_result.
  const anthropicMessages = opts.messages.map((m) => {
    if (m.role === 'tool') {
      return {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }],
      };
    }
    return { role: m.role, content: m.content };
  });

  const body: any = {
    model: opts.model,
    system: opts.systemPrompt,
    messages: anthropicMessages,
    max_tokens: opts.maxTokens ?? 1000,
    temperature: opts.temperature,
  };
  if (anthropicTools.length) body.tools = anthropicTools;

  const response = await fetch(`${provider.base_url.replace(/\/$/, '')}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 429) throw new Error('Rate limit exceeded, will retry later');
    throw new Error(`AI error (${provider.name}): ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const blocks: any[] = data.content || [];
  const textContent = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const toolCalls = blocks
    .filter((b) => b.type === 'tool_use')
    .map((b) => ({ id: b.id, function: { name: b.name, arguments: JSON.stringify(b.input) } }));

  return {
    content: textContent,
    toolCalls,
    rawAssistantMessage: { role: 'assistant', content: textContent, tool_calls: toolCalls },
  };
}

// ═══════════════════════════════════════════
// Seleção de modelo/temperatura — modo fixo (flash/pro/pro3) ou adaptive
// (heurística conforme conteúdo da conversa), sempre relativo ao provider
// selecionado (nunca hardcoded para um modelo Gemini específico).
// ═══════════════════════════════════════════
export function resolveModelAndTemperature(
  provider: AIProviderRow,
  modelMode: string,
  explicitModel: string | null | undefined,
  conversationHistory: any[],
  message: any,
  clientMemory: any
): { model: string; temperature: number } {
  if (explicitModel) return { model: explicitModel, temperature: 0.7 };

  if (modelMode === 'adaptive') {
    const { tier, temperature } = getAdaptiveTier(conversationHistory, message, clientMemory);
    return { model: tier === 'smart' ? provider.smart_model : provider.fast_model, temperature };
  }

  if (modelMode === 'pro') return { model: provider.smart_model, temperature: 0.7 };
  if (modelMode === 'pro3') return { model: provider.premium_model || provider.smart_model, temperature: 0.7 };
  return { model: provider.fast_model, temperature: 0.7 };
}

function getAdaptiveTier(
  conversationHistory: any[],
  message: any,
  clientMemory: any
): { tier: 'fast' | 'smart'; temperature: number } {
  const messageCount = conversationHistory.length;
  const userContent = message.content?.toLowerCase() || '';

  const isComplaintKeywords = ['problema', 'erro', 'não funciona', 'reclamação', 'péssimo', 'horrível'];
  const isSalesKeywords = ['preço', 'valor', 'desconto', 'comprar', 'contratar', 'plano'];
  const isTechnicalKeywords = ['como funciona', 'integração', 'api', 'configurar', 'instalar'];
  const isUrgentKeywords = ['urgente', 'agora', 'rápido', 'emergência'];

  const isComplaint = isComplaintKeywords.some((k) => userContent.includes(k));
  const isSales = isSalesKeywords.some((k) => userContent.includes(k));
  const isTechnical = isTechnicalKeywords.some((k) => userContent.includes(k));
  const isUrgent = isUrgentKeywords.some((k) => userContent.includes(k));

  const qualificationScore = clientMemory?.lead_profile?.qualification_score || 0;

  if (isComplaint || isUrgent) return { tier: 'smart', temperature: 0.3 };
  if (isSales && qualificationScore > 50) return { tier: 'fast', temperature: 0.5 };
  if (isTechnical) return { tier: 'smart', temperature: 0.4 };
  if (messageCount < 5) return { tier: 'fast', temperature: 0.8 };
  if (messageCount > 15) return { tier: 'fast', temperature: 0.5 };

  return { tier: 'fast', temperature: 0.7 };
}
