import { createClient } from "npm:@supabase/supabase-js@2.47.10";
import { downloadMedia, transcribeAudio, describeImage, extractPdfText } from "../_shared/media.ts";
import { generateEmbedding } from "../_shared/embeddings.ts";
import { resolveSendCredentials } from "../_shared/connection-resolver.ts";
import { callAIProvider, resolveModelAndTemperature, type AIProviderRow } from "../_shared/ai-providers.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mapa fixo slug ↔ nome da fila (queues.name). Setores são fixos no
// produto (Comercial/Suporte/CS/Financeiro/RH) — não precisa de tabela
// própria para isso, só uma tradução do slug usado pelas tools de IA para
// o nome exibido na tela de Filas.
const SECTOR_QUEUE_NAMES: Record<string, string> = {
  comercial: 'Comercial',
  suporte: 'Suporte',
  cs: 'CS',
  financeiro: 'Financeiro',
  rh: 'RH',
};

// Tool definitions
const updateContactInfoTool = {
  type: "function",
  function: {
    name: "update_contact_info",
    description: "Atualizar informações do contato: nome, empresa e notas com contexto coletado durante a qualificação. Chamar ao coletar o nome e ao finalizar a qualificação com o resumo do contexto.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Nome do cliente coletado na conversa"
        },
        company: {
          type: "string",
          description: "Empresa/oficina do cliente"
        },
        notes: {
          type: "string",
          description: "Resumo estruturado do contexto do lead para a equipe comercial consultar depois. Inclua: segmento, ERP, porte, pós-venda atual, perfil, dores mencionadas."
        }
      }
    }
  }
};

// Usada pelo agente Atendimento (trigger_type='default') para rotear a
// conversa para o setor certo. Só define conversations.queue_id — a
// conversa CONTINUA em modo IA (status='nina'), agora tratada pelo agente
// especializado daquela fila na próxima mensagem.
const routeToSectorTool = {
  type: "function",
  function: {
    name: "route_to_sector",
    description: "Encaminhar a conversa para o setor certo (comercial, suporte, cs, financeiro ou rh), assim que identificar o que o cliente precisa. Não tenta resolver nada — só roteia.",
    parameters: {
      type: "object",
      properties: {
        queue_slug: {
          type: "string",
          enum: ["comercial", "suporte", "cs", "financeiro", "rh"],
          description: "Setor identificado para a solicitação do cliente"
        },
        reason: {
          type: "string",
          description: "Resumo breve do que o cliente pediu, para o agente do setor já ter contexto"
        }
      },
      required: ["queue_slug", "reason"]
    }
  }
};

// Usada pelos agentes de setor (trigger_type='queue') depois de identificar
// a solicitação — encerra o atendimento por IA e avisa os atendentes reais
// daquela fila (queue_members), notificados pela própria conexão de origem
// da conversa (não mais um número fixo global).
const transferToHumanTool = {
  type: "function",
  function: {
    name: "transfer_to_human",
    description: "Encerrar o atendimento por IA e transferir a conversa para o atendente humano da fila atual, notificando-o. Chamar depois de identificar/qualificar a solicitação do cliente.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Resumo do que o cliente precisa, para o atendente humano continuar sem perder contexto"
        },
        origem: {
          type: "string",
          enum: ["campanha", "disparo", "organico", "inbound", "outbound"],
          description: "Só para a fila Comercial: classificação da origem do contato"
        },
        preferred_time: {
          type: "string",
          description: "Horário/dia que o cliente mencionou preferir, se for sobre agendamento (ex: 'terça de manhã')"
        }
      },
      required: ["reason"]
    }
  }
};

// ═══════════════════════════════════════════
// AGENT SELECTION: campanha > fila > padrão
//
// Substituiu campanha > origem > padrão: `conversations` nunca teve
// colunas `origin`/`campaign_id` de verdade, então esses gatilhos
// nunca casavam em produção. Fila (`queue_id`, atribuída manualmente
// no chat ou por conexão) e Campanha (`campaign_id`, gravada pelo
// webhook ao criar a conversa) são colunas reais agora.
// ═══════════════════════════════════════════
async function selectAgentConfig(
  supabase: ReturnType<typeof createClient>,
  ctx: { queueId: string | null; campaignId: string | null }
) {
  // 1. Campaign-specific agent (highest priority)
  if (ctx.campaignId) {
    const { data } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('trigger_type', 'campaign')
      .eq('trigger_campaign_id', ctx.campaignId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // 2. Queue-based agent
  if (ctx.queueId) {
    const { data } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('trigger_type', 'queue')
      .eq('trigger_queue_id', ctx.queueId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  // 3. Global default agent
  const { data } = await supabase
    .from('agent_configs')
    .select('*')
    .eq('trigger_type', 'default')
    .eq('is_active', true)
    .order('priority', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

// Provedor de IA do agente selecionado; cai para o provider marcado
// is_default se o agente não tiver um específico ou a linha tiver sido
// removida (nunca deixa o pipeline sem provider).
async function resolveAgentProvider(
  supabase: ReturnType<typeof createClient>,
  agentProviderId: string | null
): Promise<AIProviderRow | null> {
  if (agentProviderId) {
    const { data } = await supabase.from('ai_providers').select('*').eq('id', agentProviderId).eq('is_active', true).maybeSingle();
    if (data) return data as AIProviderRow;
  }
  const { data } = await supabase.from('ai_providers').select('*').eq('is_default', true).eq('is_active', true).maybeSingle();
  return (data as AIProviderRow) ?? null;
}

// Contexto de sistema/marca da conversa, resolvido a partir da conexão de
// origem (whatsapp_connections → connection_systems → systems). Uma
// conexão pode representar mais de um sistema (ex: "Geral Automax" atende
// Frotas + Oficina + Maxsig) — sistema_nome/sistema_saudacao usam o
// primeiro, e sistemas_possiveis lista todos, para o agente Atendimento
// não forçar o cliente a se identificar antes da hora.
interface SystemContext {
  sistema_nome: string;
  sistema_saudacao: string;
  sistemas_possiveis: string;
}

async function resolveSystemContext(
  supabase: ReturnType<typeof createClient>,
  connectionId: string | null
): Promise<SystemContext> {
  const fallback: SystemContext = { sistema_nome: '', sistema_saudacao: 'nossa empresa', sistemas_possiveis: '' };
  if (!connectionId) return fallback;

  const { data } = await supabase
    .from('connection_systems')
    .select('system:systems(name, greeting_label)')
    .eq('connection_id', connectionId);

  const systems = (data || []).map((row: any) => row.system).filter(Boolean);
  if (systems.length === 0) return fallback;

  return {
    sistema_nome: systems[0].name,
    sistema_saudacao: systems[0].greeting_label,
    sistemas_possiveis: systems.map((s: any) => s.name).join(', '),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[Nina] Starting orchestration...');

    // Libera itens presos em 'processing' há mais de 3 minutos (redeploy matou a execução anterior)
    await supabase
      .from('nina_processing_queue')
      .update({ status: 'pending', error_message: 'Reset: stuck in processing' })
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 3 * 60 * 1000).toISOString());

    const { data: queueItems, error: claimError } = await supabase
      .rpc('claim_nina_processing_batch', { p_limit: 10 });

    if (claimError) {
      console.error('[Nina] Error claiming batch:', claimError);
      throw claimError;
    }

    if (!queueItems || queueItems.length === 0) {
      console.log('[Nina] No messages to process');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[Nina] Processing ${queueItems.length} messages`);

    // ═══════════════════════════════════════════
    // DEDUPLICATION: Group by conversation, keep only latest
    // ═══════════════════════════════════════════
    const latestByConversation = new Map<string, any>();
    for (const item of queueItems) {
      const existing = latestByConversation.get(item.conversation_id);
      if (!existing || new Date(item.created_at) > new Date(existing.created_at)) {
        latestByConversation.set(item.conversation_id, item);
      }
    }

    // Mark duplicates as completed
    for (const item of queueItems) {
      const latest = latestByConversation.get(item.conversation_id);
      if (latest && item.id !== latest.id) {
        console.log(`[Nina] ⏭️ Skipping duplicate queue item ${item.id} for conversation ${item.conversation_id}`);
        await supabase
          .from('nina_processing_queue')
          .update({ 
            status: 'completed', 
            processed_at: new Date().toISOString(),
            error_message: 'Deduplicated - newer message exists'
          })
          .eq('id', item.id);
      }
    }

    const uniqueItems = Array.from(latestByConversation.values());
    console.log(`[Nina] After dedup: ${uniqueItems.length} unique conversations to process`);

    let processed = 0;

    for (const item of uniqueItems) {
      try {
        // ═══════════════════════════════════════════
        // ANTI-SPAM CHECK: Can we send to this conversation?
        // ═══════════════════════════════════════════
        const { data: canSend } = await supabase.rpc('can_send_ai_message', {
          p_conversation_id: item.conversation_id
        });

        if (canSend === false) {
          // O bloqueio de 30s de cooldown é transitório (a IA acabou de
          // responder) — descartar a mensagem aqui faz o cliente nunca
          // receber resposta se mandar duas mensagens em sequência rápida.
          // Só tratamos como definitivo (completed) quando é is_waiting_response
          // ou o limite de mensagens/hora, que exigem uma nova mensagem do
          // usuário (ou a virada da hora) pra liberar.
          const { data: control } = await supabase
            .from('ai_message_control')
            .select('last_ai_message_at, is_waiting_response, message_count_last_hour, hour_window_start')
            .eq('conversation_id', item.conversation_id)
            .maybeSingle();

          const onlyCooldown = control
            && control.is_waiting_response === false
            && !(control.message_count_last_hour > 15
                 && (Date.now() - new Date(control.hour_window_start).getTime()) < 60 * 60 * 1000);

          if (onlyCooldown) {
            const retryAt = new Date(new Date(control.last_ai_message_at).getTime() + 30 * 1000 + 1000);
            console.log(`[Nina] ⏳ ANTI-SPAM: Cooldown for conversation ${item.conversation_id} - rescheduling for ${retryAt.toISOString()}`);
            await supabase
              .from('nina_processing_queue')
              .update({
                status: 'pending',
                scheduled_for: retryAt.toISOString(),
                error_message: 'Anti-spam: rescheduled after cooldown'
              })
              .eq('id', item.id);
          } else {
            console.log(`[Nina] ❌ ANTI-SPAM: Blocked for conversation ${item.conversation_id} - waiting for user response or hourly limit`);
            await supabase
              .from('nina_processing_queue')
              .update({
                status: 'completed',
                processed_at: new Date().toISOString(),
                error_message: 'Anti-spam: blocked (waiting response or hourly limit)'
              })
              .eq('id', item.id);
          }

          continue;
        }

        // Get conversation context for agent selection
        const { data: conversation, error: convQueryError } = await supabase
          .from('conversations')
          .select('*')
          .eq('id', item.conversation_id)
          .single();

        if (!conversation) {
          const errDetail = convQueryError ? `${convQueryError.code}: ${convQueryError.message}` : 'no data';
          console.error('[Nina] Conversation not found:', item.conversation_id, '— query error:', errDetail);
          await supabase
            .from('nina_processing_queue')
            .update({
              status: 'failed',
              processed_at: new Date().toISOString(),
              error_message: `Conversation not found: ${errDetail}`
            })
            .eq('id', item.id);
          continue;
        }

        // Buscar settings com fallback triplo
        let settings = null;
        
        if (conversation.user_id) {
          const { data: userSettings } = await supabase
            .from('nina_settings')
            .select('*')
            .eq('user_id', conversation.user_id)
            .maybeSingle();
          settings = userSettings;
        }
        
        if (!settings) {
          const { data: globalSettings } = await supabase
            .from('nina_settings')
            .select('*')
            .is('user_id', null)
            .maybeSingle();
          settings = globalSettings;
        }
        
        if (!settings) {
          const { data: anySettings } = await supabase
            .from('nina_settings')
            .select('*')
            .limit(1)
            .maybeSingle();
          settings = anySettings;
        }

        const effectiveSettings = settings || {
          is_active: true,
          auto_response_enabled: true,
          response_delay_min: 1000,
          response_delay_max: 3000,
          audio_response_enabled: false,
          elevenlabs_api_key: null,
          ai_scheduling_enabled: true,
          user_id: conversation.user_id
        };

        if (!effectiveSettings.is_active) {
          console.log('[Nina] Nina is disabled for user:', conversation.user_id);
          await supabase
            .from('nina_processing_queue')
            .update({ 
              status: 'completed', 
              processed_at: new Date().toISOString(),
              error_message: 'Nina disabled for this user'
            })
            .eq('id', item.id);
          continue;
        }

        // Select agent config: campanha > fila > padrão (agent_configs
        // sempre tem uma linha 'default' ativa — ver migration
        // 20260710120000_unify_agent_configs.sql)
        const agentConfig = await selectAgentConfig(supabase, {
          queueId: conversation.queue_id ?? null,
          campaignId: conversation.campaign_id ?? null,
        });

        const systemPrompt = agentConfig?.system_prompt || getDefaultSystemPrompt();

        // Provedor de IA do agente selecionado (ver migration
        // 20260728120000_multisector_agent_structure.sql) — cai para o
        // provider marcado is_default se o agente não tiver um específico.
        const provider = await resolveAgentProvider(supabase, agentConfig?.ai_provider_id ?? null);

        // Prompt/modelo/comportamento vêm inteiramente do agente selecionado
        // (system_prompt_override/ai_model_mode/message_breaking_enabled/
        // ai_activation_delay_minutes saíram de nina_settings — unificados
        // em agent_configs)
        const mergedSettings = {
          ...effectiveSettings,
          ai_model_mode: agentConfig?.model_mode ?? 'flash',
          message_breaking_enabled: agentConfig?.message_breaking_enabled ?? true,
          ai_activation_delay_minutes: agentConfig?.ai_activation_delay_minutes ?? 5,
        };

        console.log(`[Nina] Agent selected: ${agentConfig?.name ?? 'nina_settings fallback'} (trigger: ${agentConfig?.trigger_type ?? 'none'}, provider: ${provider?.name ?? 'none'})`);

        await processQueueItem(supabase, lovableApiKey, item, systemPrompt, mergedSettings, agentConfig, provider);
        
        await supabase
          .from('nina_processing_queue')
          .update({ 
            status: 'completed', 
            processed_at: new Date().toISOString() 
          })
          .eq('id', item.id);
        
        processed++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Nina] Error processing item ${item.id}:`, error);
        
        const newRetryCount = (item.retry_count || 0) + 1;
        const shouldRetry = newRetryCount < 3;
        
        await supabase
          .from('nina_processing_queue')
          .update({ 
            status: shouldRetry ? 'pending' : 'failed',
            retry_count: newRetryCount,
            error_message: errorMessage,
            scheduled_for: shouldRetry 
              ? new Date(Date.now() + newRetryCount * 30000).toISOString() 
              : null
          })
          .eq('id', item.id);
      }
    }

    console.log(`[Nina] Processed ${processed}/${uniqueItems.length} messages`);

    return new Response(JSON.stringify({ processed, total: uniqueItems.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Nina] Orchestrator error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ═══════════════════════════════════════════
// RESPONSE VALIDATION
// ═══════════════════════════════════════════
function validateAIResponse(response: string): { message: string; issues: string[] } {
  const issues: string[] = [];
  let cleaned = response;

  if (!cleaned || cleaned.trim().length === 0) {
    issues.push('Empty response');
    return { message: 'Olá! Como posso ajudar você hoje? 😊', issues };
  }

  // Remove unwanted qualifiers the AI sometimes adds
  cleaned = cleaned.replace(/\s*\(opcional\)\s*/gi, ' ').trim();
  cleaned = cleaned.replace(/\s*\(se quiser\)\s*/gi, ' ').trim();
  cleaned = cleaned.replace(/\s*\(não obrigatório\)\s*/gi, ' ').trim();

  // Check for multiple messages / excessive length
  const lines = cleaned.split('\n').filter(l => l.trim());
  if (lines.length > 8) {
    issues.push(`Too many lines (${lines.length}), truncating`);
    cleaned = lines.slice(0, 6).join('\n');
  }

  // Detect AI-to-AI conversation patterns
  const botPatterns = [
    /sou uma? (ia|intelig[eê]ncia artificial|assistente virtual|bot)/i,
    /como assistente/i,
    /como uma? ia/i,
    /não sou (um ser )?human[oa]/i,
    /sou um modelo de linguagem/i,
    /como modelo de ia/i,
  ];

  if (botPatterns.some(p => p.test(cleaned))) {
    issues.push('AI self-identification detected');
    cleaned = 'Olá! Em que posso ajudar? 😊';
  }

  // Detect loop patterns (repetitive questions)
  const loopPatterns = [
    /continuo não entendendo/i,
    /ainda não (entendi|compreendi)/i,
    /poderia repetir/i,
    /não compreendo/i,
    /desculpe,? (mas )?não (entendi|consegui)/i,
  ];

  if (loopPatterns.some(p => p.test(cleaned))) {
    issues.push('Loop pattern detected');
    // Don't replace, just log - the AI might genuinely need clarification
  }

  // Count question marks - max 1 question per message
  const questionCount = (cleaned.match(/\?/g) || []).length;
  if (questionCount > 2) {
    issues.push(`Multiple questions detected (${questionCount})`);
    // Keep only up to the first question mark + one sentence after
    const firstQ = cleaned.indexOf('?');
    if (firstQ > -1) {
      const afterQ = cleaned.substring(firstQ + 1).trim();
      const nextSentenceEnd = afterQ.search(/[.!?]/);
      if (nextSentenceEnd > -1) {
        cleaned = cleaned.substring(0, firstQ + 1 + nextSentenceEnd + 1).trim();
      } else {
        cleaned = cleaned.substring(0, firstQ + 1).trim();
      }
    }
  }

  // Detect multiple independent paragraphs — IA deve enviar apenas 1 mensagem
  const paragraphs = cleaned.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length > 2) {
    const firstMeaningfulParagraph = paragraphs.find(p => p.trim().length > 20);
    if (firstMeaningfulParagraph) {
      issues.push('Multiple paragraphs detected — keeping first meaningful paragraph');
      cleaned = firstMeaningfulParagraph;
    }
  }

  // Check emoji count - max 2
  const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojis = cleaned.match(emojiRegex) || [];
  if (emojis.length > 2) {
    issues.push(`Too many emojis (${emojis.length})`);
    let emojiCount = 0;
    cleaned = cleaned.replace(emojiRegex, (match) => {
      emojiCount++;
      return emojiCount <= 2 ? match : '';
    });
  }

  if (issues.length > 0) {
    console.log('[Nina] ⚠️ Response validation issues:', issues.join(', '));
  }

  return { message: cleaned.trim(), issues };
}

// ═══════════════════════════════════════════
// BOT DETECTION
// ═══════════════════════════════════════════
function detectBot(message: string, lastNinaMessageAt: string | null): { isBot: boolean; score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Sinal 1: Se identifica como bot/assistente (+50 pontos)
  const botIdentifiers = [
    /sou (um |uma )?(assistente|bot|robô|sistema|chatbot|ia|inteligência artificial|atendente virtual|agente virtual)/i,
    /assistente (virtual|automático|digital)/i,
    /atendimento (automático|virtual|robotizado)/i,
    /sou (o |a )?[a-z]+ (bot|ia|assistant)/i,
    /this is an? (automated|automatic|virtual|ai)/i,
    /I am an? (ai|bot|assistant|automated)/i,
  ];
  if (botIdentifiers.some(r => r.test(message))) {
    score += 50;
    reasons.push('Se identificou como bot/assistente');
  }

  // Sinal 2: Resposta em menos de 3 segundos (+20 pontos)
  if (lastNinaMessageAt) {
    const diffMs = Date.now() - new Date(lastNinaMessageAt).getTime();
    if (diffMs < 3000) {
      score += 20;
      reasons.push(`Respondeu em ${diffMs}ms (< 3s)`);
    }
  }

  // Sinal 3: Mensagem muito longa e formatada (+15 pontos)
  const hasFormatting = /(\*[^*]+\*|_[^_]+_|\n[-•]\s|\n\d+\.\s)/.test(message);
  if (message.length > 300 && hasFormatting) {
    score += 15;
    reasons.push('Mensagem longa com formatação estruturada');
  }

  // Sinal 4: Linguagem extremamente formal e padronizada (+15 pontos)
  const formalPatterns = [
    /como posso (te |lhe )?ajudar hoje\??/i,
    /estou (aqui |disponível )?para (te |lhe )?auxiliar/i,
    /em que posso (ser útil|ajudar|auxiliar)/i,
    /atenciosamente/i,
    /cordialmente/i,
    /prezado(a)? (cliente|usuário)/i,
    /para (mais )?informações/i,
  ];
  const formalMatches = formalPatterns.filter(r => r.test(message)).length;
  if (formalMatches >= 2) {
    score += 15;
    reasons.push(`${formalMatches} padrões de linguagem robótica detectados`);
  }

  return { isBot: score >= 50, score, reasons };
}

// ═══════════════════════════════════════════
// APPOINTMENT HELPERS (unchanged logic)
// ═══════════════════════════════════════════
function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Agente Atendimento → agente de setor. Só define a fila e mantém a
// conversa em modo IA — o agente especializado daquela fila assume a
// partir da próxima mensagem (seleção de agente por conversations.queue_id,
// ver selectAgentConfig).
async function routeToSector(
  supabase: any,
  conversation: any,
  args: { queue_slug: string; reason: string }
): Promise<{ success: boolean; error?: string }> {
  console.log('[Nina] Route to sector requested:', args);

  const queueName = SECTOR_QUEUE_NAMES[args.queue_slug];
  if (!queueName) {
    console.error('[Nina] Unknown queue_slug in route_to_sector:', args.queue_slug);
    return { success: false, error: 'unknown_queue_slug' };
  }

  const { data: queue } = await supabase.from('queues').select('id').eq('name', queueName).maybeSingle();
  if (!queue) {
    console.error('[Nina] Queue not found for route_to_sector:', queueName);
    return { success: false, error: 'queue_not_found' };
  }

  await supabase.from('conversations').update({ queue_id: queue.id }).eq('id', conversation.id);
  console.log(`[Nina] Conversation ${conversation.id} routed to queue "${queueName}"`);
  return { success: true };
}

// Agente de setor → atendente humano. Marca a conversa como 'human',
// notifica todos os atendentes ativos da fila (queue_members) via a
// PRÓPRIA conexão de origem da conversa (não mais um número/instância
// fixo em nina_settings — cada conexão notifica com suas credenciais).
async function transferToHuman(
  supabase: any,
  conversation: any,
  args: { reason: string; origem?: string; preferred_time?: string }
): Promise<{ success: boolean; error?: string; notified?: number }> {
  console.log('[Nina] Transfer to human requested:', args);

  try {
    let contact = conversation.contact ?? null;
    if (!contact && conversation.contact_id) {
      const { data: freshContact } = await supabase
        .from('contacts')
        .select('name, call_name, phone_number, company, tags')
        .eq('id', conversation.contact_id)
        .maybeSingle();
      contact = freshContact;
    }

    const displayName = contact?.call_name || contact?.name || null;
    const displayPhone = contact?.phone_number || null;

    const updatePayload: Record<string, unknown> = { status: 'human' };
    if (args.origem) updatePayload.origem_classificada = args.origem;
    await supabase.from('conversations').update(updatePayload).eq('id', conversation.id);
    console.log('[Nina] Conversation switched to human mode', { queue_id: conversation.queue_id, origem: args.origem });

    // Tag do contato: TRANSFERIDO-<FILA> (fallback genérico se a fila não
    // estiver carregada na conversa por algum motivo)
    let queueName = 'ATENDIMENTO';
    if (conversation.queue_id) {
      const { data: queue } = await supabase.from('queues').select('name').eq('id', conversation.queue_id).maybeSingle();
      if (queue?.name) queueName = queue.name;
    }
    const handoffTag = `TRANSFERIDO-${queueName.toUpperCase().replace(/\s+/g, '-')}`;
    const currentTags: string[] = contact?.tags || [];
    if (!currentTags.includes(handoffTag)) {
      await supabase.from('contacts').update({ tags: [...currentTags, handoffTag] }).eq('id', conversation.contact_id);
    }

    if (!conversation.queue_id) {
      console.warn('[Nina] transfer_to_human sem queue_id na conversa — sem destinatário para notificar');
      return { success: true, error: 'no_queue', notified: 0 };
    }

    // Atendentes ativos da fila com telefone de notificação cadastrado
    const { data: members } = await supabase
      .from('queue_members')
      .select('team_member:team_members(name, notification_phone)')
      .eq('queue_id', conversation.queue_id)
      .eq('is_active', true);

    const recipients = (members || [])
      .map((m: any) => m.team_member)
      .filter((tm: any) => tm?.notification_phone);

    if (recipients.length === 0) {
      console.warn(`[Nina] Fila "${queueName}" sem atendentes com telefone de notificação cadastrado`);
      return { success: true, error: 'no_recipients', notified: 0 };
    }

    const notifMessage = `🔔 *Nova conversa transferida — ${queueName}*

👤 *Cliente:* ${displayName || 'Sem nome'}
📱 *Telefone:* ${displayPhone || 'Não informado'}${contact?.company ? `\n🏢 *Empresa:* ${contact.company}` : ''}
${args.origem ? `\n📊 *Origem:* ${args.origem}` : ''}

📋 *Contexto:*
${args.reason}
${args.preferred_time ? `\n🕒 *Preferência de horário:* ${args.preferred_time}` : ''}

_A conversa já está em modo humano no sistema._`;

    let notified = 0;
    for (const recipient of recipients) {
      try {
        const sent = await sendInternalNotification(supabase, conversation.connection_id ?? null, recipient.notification_phone, notifMessage);
        if (sent) notified++;
      } catch (err) {
        console.error(`[Nina] Falha ao notificar ${recipient.name}:`, err);
      }
    }

    return { success: true, notified };
  } catch (err) {
    console.error('[Nina] Error in transfer_to_human:', err);
    return { success: false, error: String(err) };
  }
}

// Envia um texto simples via a conexão de origem da conversa (Evolution ou
// Meta, conforme resolveSendCredentials) — usado só para as notificações
// internas de transferência, não passa pelo send_queue (não é uma mensagem
// do atendimento, é um aviso interno para o atendente).
async function sendInternalNotification(
  supabase: any,
  connectionId: string | null,
  toPhone: string,
  text: string
): Promise<boolean> {
  try {
    const creds = await resolveSendCredentials(supabase, { connectionId, apiSource: 'evolution' });
    const cleanPhone = toPhone.replace(/\D/g, '');

    if (creds.api_type === 'meta') {
      const response = await fetch(`https://graph.facebook.com/v18.0/${creds.meta_phone_number_id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creds.meta_access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone,
          type: 'text', text: { body: text },
        }),
      });
      return response.ok;
    }

    const baseUrl = (creds.evolution_api_url || '').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/message/sendText/${creds.evolution_instance_name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': creds.evolution_api_key || '' },
      body: JSON.stringify({ number: cleanPhone, text }),
    });
    return response.ok;
  } catch (err) {
    console.error('[Nina] Error sending internal notification:', err);
    return false;
  }
}

async function updateContactInfo(
  supabase: any,
  contactId: string,
  args: { name?: string; company?: string; notes?: string }
): Promise<{ success: boolean }> {
  console.log('[Nina] Updating contact info:', args);

  const updateData: any = {};
  if (args.name && args.name.trim()) updateData.name = args.name.trim();
  if (args.company && args.company.trim()) updateData.company = args.company.trim();
  if (args.notes && args.notes.trim()) updateData.notes = args.notes.trim();

  if (Object.keys(updateData).length === 0) {
    return { success: false };
  }

  try {
    const { error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', contactId);

    if (error) {
      console.error('[Nina] Error updating contact:', error);
      return { success: false };
    }

    console.log('[Nina] Contact updated successfully');
    return { success: true };
  } catch (err) {
    console.error('[Nina] Error updating contact:', err);
    return { success: false };
  }
}

async function createAppointmentFromAI(
  supabase: any, contactId: string, conversationId: string, userId: string | null,
  args: { title: string; date: string; time: string; duration?: number; type: 'demo' | 'meeting' | 'support' | 'followup'; description?: string; }
): Promise<any> {
  console.log('[Nina] Creating appointment from AI:', args);

  const appointmentDate = new Date(`${args.date}T${args.time}:00`);
  if (appointmentDate < new Date()) return { error: 'date_in_past' };

  // ── Availability validation ──────────────────────────────────────────
  const { data: availSettings } = await supabase
    .from('nina_settings')
    .select('scheduling_available_days, scheduling_start_time, scheduling_end_time, scheduling_slot_duration, scheduling_lunch_break_enabled, scheduling_lunch_start, scheduling_lunch_end')
    .limit(1)
    .single();

  const dayOfWeek = new Date(`${args.date}T12:00:00`).getDay();
  const availableDays: number[] = availSettings?.scheduling_available_days || [1, 2, 3, 4, 5];
  if (!availableDays.includes(dayOfWeek)) {
    return { error: 'day_not_available', dayOfWeek };
  }

  const requestedMinutes = parseTimeToMinutes(args.time);
  const startMinutes = parseTimeToMinutes(availSettings?.scheduling_start_time?.slice(0, 5) || '09:00');
  const endMinutes = parseTimeToMinutes(availSettings?.scheduling_end_time?.slice(0, 5) || '18:00');
  const slotDuration = availSettings?.scheduling_slot_duration || 30;
  if (requestedMinutes < startMinutes || requestedMinutes + slotDuration > endMinutes) {
    return {
      error: 'outside_hours',
      availableStart: availSettings?.scheduling_start_time?.slice(0, 5) || '09:00',
      availableEnd: availSettings?.scheduling_end_time?.slice(0, 5) || '18:00',
    };
  }

  if (availSettings?.scheduling_lunch_break_enabled) {
    const lunchStart = parseTimeToMinutes(availSettings.scheduling_lunch_start?.slice(0, 5) || '12:00');
    const lunchEnd = parseTimeToMinutes(availSettings.scheduling_lunch_end?.slice(0, 5) || '13:30');
    if (requestedMinutes < lunchEnd && requestedMinutes + slotDuration > lunchStart) {
      return {
        error: 'lunch_break',
        lunchStart: availSettings.scheduling_lunch_start?.slice(0, 5) || '12:00',
        lunchEnd: availSettings.scheduling_lunch_end?.slice(0, 5) || '13:30',
      };
    }
  }
  // ────────────────────────────────────────────────────────────────────
  
  const query = supabase.from('appointments').select('id, time, duration, title').eq('date', args.date).eq('status', 'scheduled');
  if (userId) query.eq('user_id', userId);
  const { data: existingAppointments } = await query;
  
  const requestedStart = parseTimeToMinutes(args.time);
  const requestedEnd = requestedStart + (args.duration || 60);
  
  for (const existing of existingAppointments || []) {
    const existingStart = parseTimeToMinutes(existing.time);
    const existingEnd = existingStart + (existing.duration || 60);
    if (requestedStart < existingEnd && requestedEnd > existingStart) {
      return { error: 'time_conflict', conflictWith: existing.time, conflictTitle: existing.title };
    }
  }
  
  const insertData: any = {
    title: args.title, date: args.date, time: args.time,
    duration: args.duration || 60, type: args.type,
    description: args.description || null, contact_id: contactId, status: 'scheduled',
    metadata: { source: 'nina_ai', conversation_id: conversationId, created_at_conversation: new Date().toISOString() }
  };
  if (userId) insertData.user_id = userId;
  
  const { data, error } = await supabase.from('appointments').insert(insertData).select().single();
  if (error) { console.error('[Nina] Error creating appointment:', error); return { error: error.message }; }
  console.log('[Nina] Appointment created:', data.id);
  return data;
}

async function rescheduleAppointmentFromAI(
  supabase: any, contactId: string, userId: string | null,
  args: { new_date: string; new_time: string; reason?: string; }
): Promise<any> {
  const query = supabase.from('appointments').select('*').eq('contact_id', contactId).eq('status', 'scheduled').order('date', { ascending: true }).order('time', { ascending: true }).limit(1);
  if (userId) query.eq('user_id', userId);
  const { data: existingAppointments } = await query;
  
  if (!existingAppointments || existingAppointments.length === 0) return { error: 'no_appointment_found' };
  const appointment = existingAppointments[0];
  
  if (new Date(`${args.new_date}T${args.new_time}:00`) < new Date()) return { error: 'date_in_past' };
  
  const conflictQuery = supabase.from('appointments').select('id, time, duration, title').eq('date', args.new_date).eq('status', 'scheduled').neq('id', appointment.id);
  if (userId) conflictQuery.eq('user_id', userId);
  const { data: conflictingAppointments } = await conflictQuery;
  
  const requestedStart = parseTimeToMinutes(args.new_time);
  const requestedEnd = requestedStart + (appointment.duration || 60);
  for (const existing of conflictingAppointments || []) {
    const existingStart = parseTimeToMinutes(existing.time);
    const existingEnd = existingStart + (existing.duration || 60);
    if (requestedStart < existingEnd && requestedEnd > existingStart) {
      return { error: 'time_conflict', conflictWith: existing.time, conflictTitle: existing.title };
    }
  }
  
  const { data, error } = await supabase.from('appointments').update({
    date: args.new_date, time: args.new_time,
    metadata: { ...appointment.metadata, rescheduled_at: new Date().toISOString(), rescheduled_reason: args.reason || null, previous_date: appointment.date, previous_time: appointment.time }
  }).eq('id', appointment.id).select().single();
  
  if (error) return { error: error.message };
  return { ...data, previous_date: appointment.date, previous_time: appointment.time };
}

async function cancelAppointmentFromAI(
  supabase: any, contactId: string, userId: string | null, args: { reason?: string; }
): Promise<any> {
  const query = supabase.from('appointments').select('*').eq('contact_id', contactId).eq('status', 'scheduled').order('date', { ascending: true }).order('time', { ascending: true }).limit(1);
  if (userId) query.eq('user_id', userId);
  const { data: existingAppointments } = await query;
  
  if (!existingAppointments || existingAppointments.length === 0) return { error: 'no_appointment_found' };
  const appointment = existingAppointments[0];
  
  const { data, error } = await supabase.from('appointments').update({
    status: 'cancelled',
    metadata: { ...appointment.metadata, cancelled_at: new Date().toISOString(), cancelled_reason: args.reason || null, cancelled_by: 'nina_ai' }
  }).eq('id', appointment.id).select().single();
  
  if (error) return { error: error.message };
  return data;
}

// ═══════════════════════════════════════════
// MAIN PROCESSING FUNCTION
// ═══════════════════════════════════════════
async function processQueueItem(
  supabase: any, lovableApiKey: string, item: any, systemPrompt: string, settings: any,
  agentConfig: any, provider: AIProviderRow | null
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  console.log(`[Nina] Processing queue item: ${item.id}`);

  const { data: message } = await supabase.from('messages').select('*').eq('id', item.message_id).maybeSingle();
  if (!message) throw new Error('Message not found');

  const { data: conversation } = await supabase.from('conversations').select('*, contact:contacts(*)').eq('id', item.conversation_id).maybeSingle();
  if (!conversation) throw new Error('Conversation not found');

  if (conversation.status !== 'nina') {
    console.log('[Nina] Conversation no longer in Nina mode, skipping');
    return;
  }

  if (!settings?.auto_response_enabled) {
    console.log('[Nina] Auto-response disabled');
    await supabase.from('messages').update({ processed_by_nina: true }).eq('id', message.id);
    return;
  }

  // ═══════════════════════════════════════════
  // DOUBLE-CHECK: Verify no recent AI message was sent
  // ═══════════════════════════════════════════
  const { data: recentAIMessage } = await supabase
    .from('messages')
    .select('id, sent_at')
    .eq('conversation_id', conversation.id)
    .in('from_type', ['nina', 'human'])
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentAIMessage) {
    const timeSinceLastAI = Date.now() - new Date(recentAIMessage.sent_at).getTime();
    if (timeSinceLastAI < 5000) { // 5 seconds
      console.log(`[Nina] ❌ DOUBLE-CHECK: AI sent message ${timeSinceLastAI}ms ago, skipping`);
      await supabase.from('messages').update({ processed_by_nina: true }).eq('id', message.id);
      return;
    }
  }

  // ═══════════════════════════════════════════
  // BOT DETECTION
  // ═══════════════════════════════════════════
  const { data: lastNinaMsg } = await supabase
    .from('messages')
    .select('sent_at')
    .eq('conversation_id', conversation.id)
    .eq('from_type', 'nina')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const botDetection = detectBot(message.content || '', lastNinaMsg?.sent_at || null);
  console.log('[Nina] Bot detection score:', botDetection.score, 'reasons:', botDetection.reasons);

  if (botDetection.isBot) {
    await supabase
      .from('conversations')
      .update({ status: 'paused' })
      .eq('id', conversation.id);

    const { data: contactData } = await supabase
      .from('contacts')
      .select('tags')
      .eq('id', conversation.contact_id)
      .single();

    const currentTags: string[] = contactData?.tags || [];
    if (!currentTags.includes('BOT-SUSPEITO')) {
      await supabase
        .from('contacts')
        .update({ tags: [...currentTags, 'BOT-SUSPEITO'] })
        .eq('id', conversation.contact_id);
    }

    console.log('[Nina] BOT DETECTED - conversation paused. Score:', botDetection.score, 'Reasons:', botDetection.reasons.join(', '));
    await supabase.from('messages').update({ processed_by_nina: true }).eq('id', message.id);
    return;
  }

  // ═══════════════════════════════════════════
  // SCHEDULING AUTO-TRIGGER: Lead respondeu com dia/horário após AI perguntar
  // sobre agendamento — aciona direto a transferência (sem prometer horário
  // específico), evitando esperar mais um turno da IA. Só se aplica à fila
  // Comercial (é onde existe o fluxo de agendar demonstração).
  // ═══════════════════════════════════════════
  const isComercialQueue = agentConfig?.trigger_type === 'queue' && agentConfig?.name === 'Comercial';
  if (isComercialQueue && settings.ai_scheduling_enabled !== false) {
    const { data: lastNinaMsgRaw } = await supabase
      .from('messages')
      .select('content')
      .eq('conversation_id', conversation.id)
      .eq('from_type', 'nina')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const aiAskedAboutTime = lastNinaMsgRaw?.content &&
      /agendar|agendamento|horário|que dia|qual dia|disponível para.*demo|melhor para você\?/i.test(lastNinaMsgRaw.content);

    const TIME_PATTERNS = [
      /segunda|terça|quarta|quinta|sexta|sábado|domingo/i,
      /manhã|tarde|noite|manha/i,
      /amanhã|hoje|semana (que vem|próxima)|próxim/i,
      /qualquer (horário|hora|dia)/i,
      /\b\d{1,2}h\b|\d{1,2}:\d{2}/,
    ];
    const userGavTimePreference = TIME_PATTERNS.some(p => p.test(message.content || ''));

    if (aiAskedAboutTime && userGavTimePreference) {
      console.log('[Nina] 📅 SCHEDULING AUTO-TRIGGER: lead respondeu com preferência de horário, acionando transferência diretamente');
      await transferToHuman(supabase, conversation, {
        reason: 'Lead confirmou interesse em agendar demonstração e informou preferência de horário.',
        preferred_time: message.content || undefined,
      });
      await queueHoldingMessage(supabase, conversation, message,
        'Perfeito! Vou verificar a agenda e já te retorno confirmando o horário 😊', settings);

      await supabase.from('messages').update({
        processed_by_nina: true,
        nina_response_time: Date.now() - new Date(message.sent_at).getTime()
      }).eq('id', message.id);
      return;
    }
  }

  // Check if the latest message from user is the one we're processing (avoid stale processing)
  const { data: latestUserMsg } = await supabase
    .from('messages')
    .select('id')
    .eq('conversation_id', conversation.id)
    .eq('from_type', 'user')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestUserMsg && latestUserMsg.id !== message.id) {
    // There's a newer user message - check if it has its own queue item
    const { data: newerQueueItem } = await supabase
      .from('nina_processing_queue')
      .select('id')
      .eq('message_id', latestUserMsg.id)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (newerQueueItem) {
      console.log(`[Nina] ⏭️ Newer user message exists with queue item, skipping stale message ${message.id}`);
      await supabase.from('messages').update({ processed_by_nina: true }).eq('id', message.id);
      return;
    }
  }

  // ═══════════════════════════════════════════
  // MEDIA RESOLUTION: transcreve áudio / analisa imagem / extrai texto de
  // documento antes de enviar para a IA. Caminho primário é o
  // message-grouper (roda em background); este bloco é o fallback de
  // segurança, igual ao padrão que já existia só para áudio.
  // ═══════════════════════════════════════════
  if (['audio', 'image', 'document'].includes(message.type)) {
    console.log(`[Nina] Media message detected (${message.type}), checking resolution...`);

    // Wait 2s in case the message-grouper is already resolving
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Re-fetch — grouper may have updated the content
    const { data: refreshedMsg } = await supabase
      .from('messages')
      .select('content, media_url')
      .eq('id', message.id)
      .single();

    const currentContent = refreshedMsg?.content || message.content || '';
    const placeholderMarkers = ['[áudio', '[audio', '[imagem recebida]', '[documento recebido]', '[vídeo recebido]'];
    const isAlreadyResolved =
      currentContent.length > 5 && !placeholderMarkers.some((marker) => currentContent.includes(marker));

    // Texto genérico (não menciona "imagem"/"áudio"/"documento" especificamente):
    // se o tipo detectado estiver errado por algum motivo — bug, mídia expirada,
    // classificação incorreta do webhook — a IA não afirma pro cliente um tipo
    // de mídia que pode estar errado, só pede pra repetir por texto.
    const fallbackTextByType: Record<string, string> = {
      audio: '[O cliente enviou um anexo que não foi possível processar automaticamente. Responda de forma natural pedindo que repita a informação por texto, sem mencionar problemas técnicos e sem afirmar que tipo de arquivo era.]',
      image: '[O cliente enviou um anexo que não foi possível processar automaticamente. Responda de forma natural pedindo que repita a informação por texto, sem mencionar problemas técnicos e sem afirmar que tipo de arquivo era.]',
      document: '[O cliente enviou um anexo que não foi possível processar automaticamente. Responda de forma natural pedindo que repita a informação por texto, sem mencionar problemas técnicos e sem afirmar que tipo de arquivo era.]',
    };

    if (isAlreadyResolved) {
      message.content = currentContent;
      console.log('[Nina] Grouper already resolved media:', currentContent.substring(0, 50));
    } else {
      const mediaId = refreshedMsg?.media_url || message.media_url;
      let resolvedContent: string | null = null;

      if (mediaId) {
        try {
          // Credenciais da CONEXÃO que recebeu a mensagem — com múltiplas
          // conexões Evolution (ex: Atendimento, Automax), usar sempre o
          // único nina_settings global baixava a mídia com a instância
          // errada (falha silenciosa), e a IA acabava dizendo que não
          // conseguia ouvir/ver o anexo mesmo quando a transcrição deveria
          // funcionar normalmente.
          let mediaSettings: any = null;
          if (conversation.connection_id) {
            const { data: conn } = await supabase
              .from('whatsapp_connections')
              .select('meta_access_token, evolution_base_url, evolution_api_key, evolution_instance_name')
              .eq('id', conversation.connection_id)
              .maybeSingle();
            if (conn) {
              mediaSettings = {
                meta_access_token: conn.meta_access_token,
                evolution_api_url: conn.evolution_base_url,
                evolution_api_key: conn.evolution_api_key,
                evolution_instance_name: conn.evolution_instance_name,
              };
            }
          }
          if (!mediaSettings) {
            const { data: legacySettings } = await supabase
              .from('nina_settings')
              .select('meta_access_token, evolution_api_url, evolution_api_key, evolution_instance_name')
              .limit(1)
              .single();
            mediaSettings = legacySettings;
          }

          const mediaBuffer = await downloadMedia(mediaSettings || {}, mediaId);

          if (mediaBuffer && mediaBuffer.byteLength > 0) {
            if (message.type === 'audio') {
              resolvedContent = await transcribeAudio(mediaBuffer, lovableApiKey);
            } else if (message.type === 'image') {
              resolvedContent = await describeImage(mediaBuffer, 'image/jpeg', lovableApiKey, message.content);
            } else if (message.type === 'document') {
              resolvedContent = await extractPdfText(mediaBuffer);
            }
          }
        } catch (err) {
          console.error(`[Nina] Media resolution error (${message.type}):`, err);
        }
      }

      if (resolvedContent) {
        message.content = resolvedContent;
        await supabase.from('messages').update({ content: resolvedContent }).eq('id', message.id);
        console.log(`[Nina] Media resolved (${message.type}):`, resolvedContent.substring(0, 80));
      } else {
        message.content = fallbackTextByType[message.type];
      }
    }
  }

  // Get recent messages for context (last 20)
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversation.id)
    .order('sent_at', { ascending: false })
    .limit(20);

  const conversationHistory = (recentMessages || [])
    .reverse()
    .filter((msg: any) => ['nina', 'human', 'user'].includes(msg.from_type))
    .map((msg: any) => ({
      role: msg.from_type === 'nina' ? 'assistant' : 'user',
      content: msg.content || '[media]'
    }));

  const clientMemory = conversation.contact?.client_memory || {};

  const origemConversa = await detectarOrigemConversa(supabase, conversation.contact_id, conversation.id, recentMessages || []);
  console.log('[Nina] Origem da conversa:', origemConversa);

  // ═══════════════════════════════════════════
  // BASE DE CONHECIMENTO (RAG): busca chunks relevantes para a mensagem atual
  // ═══════════════════════════════════════════
  let knowledgeChunks: string[] = [];
  if (settings?.rag_enabled && message.content) {
    try {
      const queryEmbedding = await generateEmbedding(message.content, lovableApiKey);
      if (queryEmbedding) {
        const { data: matches, error: matchError } = await supabase.rpc('match_documents', {
          query_embedding: queryEmbedding,
          match_threshold: 0.72,
          match_count: 4,
          p_queue_id: conversation.queue_id ?? null,
        });
        if (matchError) {
          console.error('[Nina] Erro buscando base de conhecimento:', matchError);
        } else if (matches?.length) {
          knowledgeChunks = matches.map((m: any) => m.content);
          console.log(`[Nina] ${knowledgeChunks.length} chunks relevantes encontrados na base de conhecimento`);
        }
      }
    } catch (ragError) {
      // Falha no RAG não deve travar a resposta ao cliente — segue sem contexto extra
      console.error('[Nina] Erro no fluxo de RAG:', ragError);
    }
  }

  const systemContext = await resolveSystemContext(supabase, conversation.connection_id ?? null);

  // ═══════════════════════════════════════════
  // AÇÕES DE TAG: tags do contato podem carregar uma instrução para a IA
  // (ex: tag "Cliente" → não perguntar de novo se a pessoa é cliente).
  // Configurável em Configurações > Tags (tag_definitions.has_action).
  // ═══════════════════════════════════════════
  let tagInstructions: string[] = [];
  const contactTags: string[] = conversation.contact?.tags || [];
  if (contactTags.length > 0) {
    const { data: actionTags } = await supabase
      .from('tag_definitions')
      .select('key, ai_instruction')
      .eq('has_action', true)
      .not('ai_instruction', 'is', null)
      .in('key', contactTags);
    tagInstructions = (actionTags || [])
      .map((t: any) => t.ai_instruction)
      .filter((instruction: string | null) => !!instruction?.trim());
  }

  const enhancedSystemPrompt = buildEnhancedPrompt(systemPrompt, conversation.contact, clientMemory, origemConversa, message.content || '', knowledgeChunks, tagInstructions);

  // Dispara o motor de automação (gatilho 'new_message') em background — a
  // mensagem já está resolvida (mídia/RAG), então condições sobre o conteúdo
  // avaliam o texto real, não um placeholder.
  fetch(`${supabaseUrl}/functions/v1/automation-executor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
    body: JSON.stringify({
      event_type: 'new_message',
      contact_id: conversation.contact_id,
      conversation_id: conversation.id,
      message_content: message.content,
    }),
  }).catch((err) => console.error('[Nina] Error triggering automation-executor:', err));

  // Fetch deal data
  let dealData: any = null;
  try {
    const { data: deal } = await supabase.from('deals').select('*, stage_info:pipeline_stages(title)').eq('contact_id', conversation.contact_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    dealData = deal;
  } catch (e) { console.log('[Nina] Could not fetch deal data:', e); }

  const { count: totalMessages } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversation.id);
  const hasHistory = origemConversa?.origem === 'retorno';

  const processedPrompt = processPromptTemplate(enhancedSystemPrompt, conversation.contact, origemConversa, {
    dealData, settings, conversationStatus: conversation.status, totalMessages: totalMessages || 0, hasHistory, systemContext,
  });

  if (!provider) {
    throw new Error('Nenhum provedor de IA configurado (ai_providers vazio ou sem is_default)');
  }
  console.log(`[Nina] Calling AI provider "${provider.name}"...`);

  const aiSettings = resolveModelAndTemperature(
    provider, settings?.ai_model_mode || 'flash', agentConfig?.ai_model, conversationHistory, message, clientMemory
  );

  // route_to_sector é só do agente Atendimento (trigger_type='default');
  // transfer_to_human é dos agentes de setor (trigger_type='queue') — cada
  // agente só recebe a ferramenta que faz sentido para o seu papel.
  const tools: any[] = [updateContactInfoTool];
  if (agentConfig?.trigger_type === 'default') {
    tools.push(routeToSectorTool);
  } else {
    tools.push(transferToHumanTool);
  }

  let aiResult;
  try {
    aiResult = await callAIProvider(provider, {
      systemPrompt: processedPrompt,
      messages: conversationHistory,
      tools,
      model: aiSettings.model,
      temperature: aiSettings.temperature,
      maxTokens: 1000,
    });
  } catch (err) {
    console.error('[Nina] AI provider error:', err);
    throw err;
  }

  let aiContent = aiResult.content;
  const toolCalls = aiResult.toolCalls;

  console.log('[Nina] AI response received, content length:', aiContent?.length || 0, ', tool_calls:', toolCalls.length);

  // Process tool calls
  let handoffDone = false;
  const toolResults: { toolCall: any; result: any }[] = [];

  for (const toolCall of toolCalls) {
    if (toolCall.function?.name === 'route_to_sector') {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const routeResult = await routeToSector(supabase, conversation, args);
        toolResults.push({ toolCall, result: routeResult });
      } catch (parseError) {
        console.error('[Nina] Error parsing route_to_sector:', parseError);
      }
    }

    if (toolCall.function?.name === 'transfer_to_human') {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const handoffResult = await transferToHuman(supabase, conversation, args);
        aiContent = aiContent || 'Vou te passar para nossa equipe. Eles entrarão em contato em breve! 😊';
        handoffDone = true;
        toolResults.push({ toolCall, result: handoffResult });
      } catch (parseError) {
        console.error('[Nina] Error parsing transfer_to_human:', parseError);
      }
    }

    if (toolCall.function?.name === 'update_contact_info') {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const updateResult = await updateContactInfo(supabase, conversation.contact_id, args);
        // Silent action — não adiciona texto sozinho, mas o resultado é
        // devolvido ao modelo abaixo para ele continuar a conversa normalmente.
        toolResults.push({ toolCall, result: updateResult });
      } catch (parseError) {
        console.error('[Nina] Error parsing update_contact_info:', parseError);
      }
    }
  }

  // Quando o modelo só chamou a tool (sem texto na mesma resposta) e não houve
  // handoff, é preciso devolver o resultado da tool e pedir a resposta final —
  // do contrário perdemos o fio da conversa (ex: usuário respondeu uma pergunta
  // de qualificação e a IA "esquece" o que estava perguntando).
  if (!aiContent && toolCalls.length > 0 && !handoffDone && toolResults.length > 0) {
    try {
      const followUpMessages: any[] = [
        ...conversationHistory,
        aiResult.rawAssistantMessage || { role: 'assistant', content: '' },
        ...toolResults.map(({ toolCall, result }) => ({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        })),
      ];

      const followUpResult = await callAIProvider(provider, {
        systemPrompt: processedPrompt,
        messages: followUpMessages,
        model: aiSettings.model,
        temperature: aiSettings.temperature,
        maxTokens: 1000,
      });
      aiContent = followUpResult.content || '';
      console.log('[Nina] Follow-up completion after tool call, content length:', aiContent.length);
    } catch (err) {
      console.error('[Nina] Error in follow-up completion after tool call:', err);
    }
  }

  if (!aiContent && toolCalls.length > 0) {
    if (handoffDone) {
      aiContent = 'Nossa equipe comercial vai entrar em contato em breve! 😊';
    } else {
      aiContent = 'Entendi! Como posso ajudar?';
    }
  }

  if (!aiContent) {
    console.warn('[Nina] Empty AI response, using fallback');
    const fallbackIntent = detectExplicitIntent(message.content || '');
    if (isComercialQueue && fallbackIntent.has && fallbackIntent.desc.includes('demonstração')) {
      await transferToHuman(supabase, conversation, {
        reason: 'Lead demonstrou interesse em agendar demonstração (resposta vazia da IA).',
      });
      aiContent = 'Vou verificar a agenda e já te retorno confirmando o horário! 😊';
    } else {
      aiContent = 'Olá! Como posso ajudar você hoje? 😊';
    }
  }

  // ═══════════════════════════════════════════
  // VALIDATE AI RESPONSE
  // ═══════════════════════════════════════════
  const validation = validateAIResponse(aiContent);
  aiContent = validation.message;
  
  if (validation.issues.length > 0) {
    console.log('[Nina] Response validated with issues:', validation.issues);
  }

  console.log('[Nina] Final response length:', aiContent.length);

  // Calculate response time
  const responseTime = Date.now() - new Date(message.sent_at).getTime();

  // Update original message as processed
  await supabase.from('messages').update({ processed_by_nina: true, nina_response_time: responseTime }).eq('id', message.id);

  // ═══════════════════════════════════════════
  // MARK AI MESSAGE AS SENT (anti-spam control)
  // ═══════════════════════════════════════════
  await supabase.rpc('mark_ai_message_sent', {
    p_conversation_id: conversation.id,
    p_content: aiContent.substring(0, 500) // truncate for storage
  });

  // Add response delay
  const delayMin = settings?.response_delay_min || 1000;
  const delayMax = settings?.response_delay_max || 3000;
  const delay = Math.random() * (delayMax - delayMin) + delayMin;

  const totalChunks = settings?.message_breaking_enabled 
    ? breakMessageIntoChunks(aiContent).length 
    : 1;
  await queueTextResponse(supabase, conversation, message, aiContent, settings, aiSettings, delay);

  // Trigger whatsapp-sender
  const lastChunkDelay = delay + ((totalChunks - 1) * 1500);
  const senderTriggerDelay = lastChunkDelay + 500;
  
  try {
    const senderUrl = `${supabaseUrl}/functions/v1/whatsapp-sender`;
    console.log(`[Nina] Waiting ${senderTriggerDelay}ms for chunks before triggering sender`);
    await new Promise(resolve => setTimeout(resolve, senderTriggerDelay));
    
    fetch(senderUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ triggered_by: 'nina-orchestrator' })
    }).catch(err => console.error('[Nina] Error triggering whatsapp-sender:', err));
  } catch (err) {
    console.error('[Nina] Failed to trigger whatsapp-sender:', err);
  }

  // Trigger analyze-conversation
  fetch(`${supabaseUrl}/functions/v1/analyze-conversation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
    body: JSON.stringify({
      contact_id: conversation.contact_id, conversation_id: conversation.id,
      user_message: message.content, ai_response: aiContent, current_memory: clientMemory
    })
  }).catch(err => console.error('[Nina] Error triggering analyze-conversation:', err));

}

// Queue text response with chunking
async function queueTextResponse(
  supabase: any, conversation: any, message: any, aiContent: string,
  settings: any, aiSettings: any, delay: number, appointmentCreated?: any
) {
  const messageChunks = settings?.message_breaking_enabled 
    ? breakMessageIntoChunks(aiContent) : [aiContent];

  console.log(`[Nina] Sending ${messageChunks.length} text message chunk(s)`);

  for (let i = 0; i < messageChunks.length; i++) {
    const chunkDelay = delay + (i * 1500);
    
    const { error: sendQueueError } = await supabase.from('send_queue').insert({
      conversation_id: conversation.id, contact_id: conversation.contact_id,
      connection_id: conversation.connection_id ?? null,
      content: messageChunks[i], from_type: 'nina', message_type: 'text', priority: 1,
      scheduled_at: new Date(Date.now() + chunkDelay).toISOString(),
      metadata: {
        response_to_message_id: message.id, ai_model: aiSettings.model,
        chunk_index: i, total_chunks: messageChunks.length,
        appointment_created: appointmentCreated?.id || null
      }
    });

    if (sendQueueError) {
      console.error('[Nina] Error queuing response chunk:', sendQueueError);
      throw sendQueueError;
    }
  }
}

// ═══════════════════════════════════════════
// SCHEDULING HOLDING MESSAGE HELPER
// ═══════════════════════════════════════════

async function queueHoldingMessage(
  supabase: any, conversation: any, triggerMessage: any,
  content: string, settings: any, extraDelayMs = 0
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const delay = (settings?.response_delay_min || 1000) + extraDelayMs;

  await supabase.from('send_queue').insert({
    conversation_id: conversation.id,
    contact_id: conversation.contact_id,
    connection_id: conversation.connection_id ?? null,
    content,
    from_type: 'nina',
    message_type: 'text',
    priority: 1,
    scheduled_at: new Date(Date.now() + delay).toISOString(),
    metadata: { response_to_message_id: triggerMessage.id, scheduling_holding_message: true }
  });

  await supabase.rpc('mark_ai_message_sent', {
    p_conversation_id: conversation.id,
    p_content: content.substring(0, 500),
  });

  await new Promise(resolve => setTimeout(resolve, delay + 500));
  fetch(`${supabaseUrl}/functions/v1/whatsapp-sender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
    body: JSON.stringify({ triggered_by: 'nina-orchestrator-scheduling' }),
  }).catch(err => console.error('[Nina] Scheduling sender trigger failed:', err));
}

function getDefaultSystemPrompt(): string {
  // Fallback de último recurso — só ativado se agent_configs não tiver
  // nenhum agente default ativo e nina_settings não tiver prompt override.
  // Em produção normal esse código nunca é executado.
  return `<system_instruction>
<role>
Você é a Cris, SDR da PremaCar.
Sua função é prospectar e qualificar donos de oficinas mecânicas, centros automotivos e auto centers para uma demonstração da plataforma PremaCar.
Você age como uma consultora que entende do setor automotivo, jamais como uma vendedora agressiva ou robótica.
Data e hora atual: {{ data_hora }} ({{ dia_semana }})
</role>

<company>
Nome: PremaCar
Produto: Plataforma SaaS de pós-venda e fidelização para o setor automotivo
Proposta de valor: Recupera clientes inativos automaticamente via WhatsApp, aumentando retorno e faturamento sem trabalho manual
Preço: R$ 650/mês — trial grátis de 14 dias — configuração em 12 minutos
Público: Donos e gestores de oficinas mecânicas, centros automotivos e auto centers
</company>

<qualification>
Perguntas de qualificação (uma por vez, nesta ordem):
1. Confirmar tipo de estabelecimento (oficina, centro automotivo, auto center?)
2. Tamanho da base de clientes (quantos clientes ativos por mês?)
3. Como fazem follow-up hoje? (WhatsApp manual, sistema, nenhum?)

Lead qualificado: tem 50+ clientes/mês, não tem processo de follow-up estruturado ou quer melhorar o que tem.
Objetivo: agendar demonstração de 15 minutos.
</qualification>

<guidelines>
Formatação:
1. Brevidade: Mensagens de 2-4 linhas. Máximo 6 linhas.
2. Fluxo: APENAS UMA pergunta por vez. Jamais empilhe perguntas.
3. Tom: Profissional, direto, amigável. Use o nome quando souber.
4. Linguagem: Português brasileiro natural. Sem jargões técnicos.

REGRA CRÍTICA:
- Envie APENAS UMA mensagem por resposta
- Aguarde SEMPRE a resposta antes de continuar
- Nunca se identifique como IA, robô ou assistente virtual
- Nunca pressione para fechar — deixe o interesse surgir naturalmente

AGENDAMENTO DE DEMO:
- Quando o lead CONFIRMAR que quer agendar, chame a tool transfer_to_human
- NUNCA confirme um horário específico como já agendado — a equipe comercial confirma manualmente depois
- Responda apenas algo como "Perfeito! Vou verificar a agenda e já te retorno confirmando o horário"
- Não chame a tool se o lead ainda não confirmou interesse em agendar
</guidelines>

<cognitive_process>
Para CADA mensagem, siga este processo:
1. ANALISAR: Em qual etapa está? (Descoberta, Qualificação, Proposta, Agendamento)
2. VERIFICAR: O que ainda não sei? (Tipo? Porte? Follow-up atual?)
3. PLANEJAR: Qual a melhor pergunta aberta para avançar?
4. REDIGIR: Resposta empática e concisa (2-4 linhas, 1 pergunta).
5. REVISAR: Tem mais de 1 pergunta? Remover extras.
</cognitive_process>

<examples>
Bom:
Lead: "Oi, vim pelo Instagram"
Cris: "Oi! Que bom ter você aqui. Me conta, você tem oficina ou centro automotivo?"

Bom:
Lead: "Tenho uma oficina com uns 200 clientes"
Cris: "Legal! E quando um cliente some por mais de 3 meses, vocês fazem algum contato pra trazer ele de volta?"

Ruim (múltiplas perguntas):
Lead: "Tenho oficina"
Cris: "Ótimo! Há quanto tempo? Quantos funcionários? Usa algum sistema? Faz follow-up?" ❌
</examples>
</system_instruction>`;
}

// Detect conversation origin
async function detectarOrigemConversa(
  supabase: any, contactId: string, conversationId: string, recentMessages: any[]
): Promise<{ origem: string; detalhes: string }> {
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    const { data: disparoRecente } = await supabase
      .from('campaign_leads')
      .select('*, campaign:campaigns(*)')
      .eq('phone', (await supabase.from('contacts').select('phone_number').eq('id', contactId).single()).data?.phone_number || '')
      .gte('sent_at', twoHoursAgo.toISOString())
      .is('replied_at', null)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const { data: historicoConversas } = await supabase
      .from('conversations')
      .select('id, started_at')
      .eq('contact_id', contactId)
      .neq('id', conversationId)
      .order('started_at', { ascending: false })
      .limit(10);
    
    let conversasComInteracao = 0;
    if (historicoConversas && historicoConversas.length > 0) {
      for (const conv of historicoConversas) {
        const { count } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).eq('from_type', 'user');
        if (count && count > 0) { conversasComInteracao++; if (conversasComInteracao >= 2) break; }
      }
    }
    
    const userMessagesInConversation = recentMessages.filter(m => m.from_type === 'user').length;
    const hasBroadcastMessage = recentMessages.some(m => m.from_type === 'nina' && m.metadata?.is_broadcast === true);
    
    if (disparoRecente || (hasBroadcastMessage && userMessagesInConversation <= 2)) {
      if (disparoRecente) {
        await supabase.from('campaign_leads').update({ replied_at: now.toISOString(), status: 'replied' }).eq('id', disparoRecente.id);
      }
      return { origem: 'disparo', detalhes: `Lead respondendo a disparo automático. Continue naturalmente.` };
    }
    
    // "inbound" (apresentar-se) só deve valer para a 1ª mensagem do contato
    // nesta conversa. Da 2ª mensagem em diante, mesmo sem conversas
    // anteriores, a IA não deve se reapresentar — o limiar "> 3" antigo
    // fazia a IA se apresentar de novo nas mensagens 2 e 3 da conversa.
    if (conversasComInteracao > 0 || userMessagesInConversation > 1) {
      return { origem: 'retorno', detalhes: `Cliente com ${conversasComInteracao} conversa(s) anterior(es) ou já em andamento nesta conversa. Seja natural, sem se reapresentar.` };
    }

    return { origem: 'inbound', detalhes: 'Primeiro contato. Apresente-se e faça perguntas de descoberta.' };
    
  } catch (error) {
    console.error('[Nina] Erro ao detectar origem:', error);
    return { origem: 'inbound', detalhes: 'Não foi possível detectar origem.' };
  }
}

function processPromptTemplate(
  prompt: string, contact: any, origemConversa?: { origem: string; detalhes: string },
  extraContext?: { dealData?: any; settings?: any; conversationStatus?: string; totalMessages?: number; hasHistory?: boolean; systemContext?: SystemContext; }
): string {
  const now = new Date();
  const brOptions: Intl.DateTimeFormatOptions = { timeZone: 'America/Sao_Paulo' };
  
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', { ...brOptions, day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeFormatter = new Intl.DateTimeFormat('pt-BR', { ...brOptions, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { ...brOptions, weekday: 'long' });

  let primeiroContato = '';
  if (contact?.first_contact_date) {
    try { primeiroContato = new Intl.DateTimeFormat('pt-BR', { ...brOptions, day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(contact.first_contact_date)); } catch { primeiroContato = ''; }
  }

  const deal = extraContext?.dealData;
  const dealEstagio = deal?.stage_info?.title || deal?.stage || '';
  const dealValor = deal?.value ? `R$ ${Number(deal.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '';
  const dealTitulo = deal?.title || '';
  
  const variables: Record<string, string> = {
    'data_hora': `${dateFormatter.format(now)} ${timeFormatter.format(now)}`,
    'data': dateFormatter.format(now),
    'hora': timeFormatter.format(now),
    'dia_semana': weekdayFormatter.format(now),
    'cliente_nome': contact?.name || contact?.call_name || 'Cliente',
    'cliente_nome_com_virgula': (contact?.name || contact?.call_name) ? `, ${contact.name || contact.call_name}` : '',
    'cliente_telefone': contact?.phone_number || '',
    'cliente_email': contact?.email || '',
    'cliente_tags': (contact?.tags || []).join(', '),
    'cliente_notas': contact?.notes || '',
    'cliente_oficina': contact?.oficina || '',
    'primeiro_contato': primeiroContato,
    'origem_conversa': origemConversa?.origem || 'inbound',
    'historico_conversa': extraContext?.hasHistory ? 'true' : 'false',
    'deal_estagio': dealEstagio,
    'deal_valor': dealValor,
    'deal_titulo': dealTitulo,
    'empresa_nome': extraContext?.settings?.company_name || '',
    'agente_nome': extraContext?.settings?.sdr_name || '',
    'total_mensagens': String(extraContext?.totalMessages || 0),
    'conversa_status': extraContext?.conversationStatus || '',
    'sistema_nome': extraContext?.systemContext?.sistema_nome || '',
    'sistema_saudacao': extraContext?.systemContext?.sistema_saudacao || 'nossa empresa',
    'sistemas_possiveis': extraContext?.systemContext?.sistemas_possiveis || '',
  };
  
  return prompt.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, varName) => variables[varName] || match);
}

const EXPLICIT_INTENT_PATTERNS = [
  /agendar|agendam|agend/i,
  /demonstra[çc][aã]o|demonstra[çc]|demo\b/i,
  /quero (ver|conhecer|saber|testar|assinar|contratar)/i,
  /como funciona|como (é|e) o sistema/i,
  /pre[çc]o|valor|plano|mensalidade|custo/i,
  /marcar|marque|marca/i,
  /trial|teste gratuito/i,
  /quero (mais )?informa[çc][oõ]es/i,
];

function detectExplicitIntent(msg: string): { has: boolean; desc: string } {
  const lower = msg.toLowerCase();
  if (EXPLICIT_INTENT_PATTERNS.some(p => p.test(lower))) {
    if (/agendar|demonstra|demo|marcar/i.test(lower)) return { has: true, desc: 'quer agendar demonstração' };
    if (/pre[çc]o|valor|plano|mensalidade/i.test(lower)) return { has: true, desc: 'perguntou sobre preço/planos' };
    if (/quero (ver|conhecer|saber|testar)|como funciona/i.test(lower)) return { has: true, desc: 'quer conhecer o produto' };
    return { has: true, desc: 'expressou interesse explícito' };
  }
  return { has: false, desc: '' };
}

function buildEnhancedPrompt(basePrompt: string, contact: any, memory: any, origemConversa?: { origem: string; detalhes: string }, latestUserMessage = '', knowledgeChunks: string[] = [], tagInstructions: string[] = []): string {
  const intent = detectExplicitIntent(latestUserMessage);
  let contextInfo = '';

  if (origemConversa) {
    contextInfo += `\n\n<origem_conversa>
TIPO: ${origemConversa.origem.toUpperCase()}
INSTRUÇÃO: ${origemConversa.detalhes}

REGRAS BASEADAS NA ORIGEM:
${origemConversa.origem === 'disparo' ? `
- NÃO se apresente novamente
- Continue a conversa naturalmente
- Agradeça a resposta e avance para descobrir a dor/interesse
` : ''}
${origemConversa.origem === 'inbound' && !intent.has ? `
- Apresente-se formalmente (primeiro contato)
- Use saudação calorosa
- Faça UMA pergunta de descoberta
` : ''}
${origemConversa.origem === 'retorno' ? `
- Reconheça que já conversaram antes
- Seja amigável mas não excessivamente formal
- Pergunte se pode ajudar com algo novo
` : ''}
</origem_conversa>`;
  }

  if (contact) {
    contextInfo += `\n\nCONTEXTO DO CLIENTE:`;
    if (contact.name) contextInfo += `\n- Nome: ${contact.name}`;
    if (contact.call_name) contextInfo += ` (trate por: ${contact.call_name})`;
    if (contact.tags?.length) contextInfo += `\n- Tags: ${contact.tags.join(', ')}`;
  }

  if (tagInstructions.length > 0) {
    contextInfo += `\n\n<instrucoes_por_tag>
${tagInstructions.map((instruction) => `- ${instruction}`).join('\n')}
</instrucoes_por_tag>`;
  }

  if (memory && Object.keys(memory).length > 0) {
    contextInfo += `\n\nMEMÓRIA DO CLIENTE:`;
    if (memory.lead_profile) {
      const lp = memory.lead_profile;
      if (lp.interests?.length) contextInfo += `\n- Interesses: ${lp.interests.join(', ')}`;
      if (lp.products_discussed?.length) contextInfo += `\n- Produtos discutidos: ${lp.products_discussed.join(', ')}`;
      if (lp.lead_stage) contextInfo += `\n- Estágio: ${lp.lead_stage}`;
    }
    if (memory.sales_intelligence) {
      const si = memory.sales_intelligence;
      if (si.pain_points?.length) contextInfo += `\n- Dores: ${si.pain_points.join(', ')}`;
      if (si.next_best_action) contextInfo += `\n- Próxima ação sugerida: ${si.next_best_action}`;
    }
  }

  if (intent.has) {
    contextInfo += `\n\n<intencao_explicita>
ATENÇÃO: O lead acabou de expressar intenção explícita: "${intent.desc}".
- NÃO use saudação genérica como "Olá! Como posso ajudar?"
- Responda DIRETAMENTE à solicitação
- Se quiser agendar demo: confirme o interesse, colete tipo de estabelecimento (se ainda não tem), e quando tiver informação suficiente, chame a tool transfer_to_human (nunca confirme um horário específico sozinho)
- Seja objetivo e mostre que entendeu o pedido
</intencao_explicita>`;
  }

  let knowledgeBaseInfo = '';
  if (knowledgeChunks.length > 0) {
    knowledgeBaseInfo = `\n\n<base_de_conhecimento>
Use as informações abaixo SOMENTE se forem relevantes para a pergunta do cliente. Não invente informações fora daqui e não mencione que está consultando uma "base de conhecimento".
${knowledgeChunks.map((chunk, i) => `[${i + 1}] ${chunk}`).join('\n\n')}
</base_de_conhecimento>`;
  }

  const antiDoubleMessageInstruction = `

INSTRUÇÃO CRÍTICA DE FORMATO:
- Responda com APENAS 1 mensagem curta
- NUNCA envie 2 perguntas ou 2 blocos de texto separados
- Se precisar fazer uma pergunta, faça APENAS 1
- Não use duplo Enter (parágrafo duplo) para separar ideias diferentes
- Use Enter simples se precisar de quebra de linha
- NUNCA adicione "(opcional)", "(se quiser)" ou qualificadores entre parênteses nas mensagens`;

  return basePrompt + contextInfo + knowledgeBaseInfo + antiDoubleMessageInstruction;
}

function breakMessageIntoChunks(content: string): string[] {
  const chunks = content.split(/\n\n+/).map(c => c.trim()).filter(c => c.length > 0);

  if (chunks.length <= 1) return chunks.length > 0 ? chunks : [content];

  // Regra 1: 2+ perguntas independentes → juntar
  const questionsCount = chunks.filter(c => c.trim().endsWith('?')).length;
  if (questionsCount > 1) {
    console.log('[Nina] Multiple questions detected, merging into 1 message');
    return [chunks.join('\n\n')];
  }

  // Regra 2: 2+ chunks com frases completas → são mensagens independentes, juntar
  const completeChunks = chunks.filter(c => /[.!?😊😄🙂]$/.test(c.trim()));
  if (completeChunks.length >= 2) {
    console.log('[Nina] Multiple complete sentences detected, merging into 1 message');
    return [chunks.join('\n\n')];
  }

  // Regra 3: Mais de 2 chunks → sempre juntar
  if (chunks.length > 2) {
    console.log('[Nina] Too many chunks, merging into 1 message');
    return [chunks.join('\n\n')];
  }

  return chunks;
}

// Seleção de modelo/temperatura (fixo ou adaptive) foi movida para
// _shared/ai-providers.ts (resolveModelAndTemperature) — agora é relativa
// ao provider configurado no agente, não mais hardcoded para Gemini.
