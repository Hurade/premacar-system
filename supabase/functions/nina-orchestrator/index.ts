import { createClient } from "npm:@supabase/supabase-js@2.47.10";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

const handoffToHumanTool = {
  type: "function",
  function: {
    name: "request_demo_handoff",
    description: "Acionar APENAS quando o lead pede explicitamente para falar com um humano/atendente real, ou quando há um problema complexo que a IA não consegue resolver. NÃO usar para agendamento de demonstração — para agendar demo, inclua o marcador [AGENDAR_DEMO] na resposta.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Motivo da transferência: por que o lead precisa falar com um humano agora"
        },
        preferred_time: {
          type: "string",
          description: "Horário/dia que o lead mencionou preferir (se informou). Ex: 'terça de manhã', 'qualquer horário', 'entre 14h e 16h'"
        }
      },
      required: ["reason"]
    }
  }
};

// ═══════════════════════════════════════════
// AGENT SELECTION: campaign > origin > default
// ═══════════════════════════════════════════
async function selectAgentConfig(
  supabase: ReturnType<typeof createClient>,
  ctx: { origin: string; campaignId: string | null }
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

  // 2. Origin-based agent
  if (ctx.origin) {
    const { data } = await supabase
      .from('agent_configs')
      .select('*')
      .eq('trigger_type', 'origin')
      .eq('trigger_origin', ctx.origin)
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
          console.log(`[Nina] ❌ ANTI-SPAM: Blocked for conversation ${item.conversation_id} - waiting for user response or cooldown`);
          await supabase
            .from('nina_processing_queue')
            .update({ 
              status: 'completed', 
              processed_at: new Date().toISOString(),
              error_message: 'Anti-spam: blocked (waiting response or cooldown)'
            })
            .eq('id', item.id);
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
          system_prompt_override: null,
          ai_model_mode: 'flash',
          response_delay_min: 1000,
          response_delay_max: 3000,
          message_breaking_enabled: false,
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

        // Select agent config: campaign > origin > default > nina_settings fallback
        const agentConfig = await selectAgentConfig(supabase, {
          origin: conversation.origin ?? 'inbound',
          campaignId: conversation.campaign_id ?? null,
        });

        const systemPrompt = agentConfig?.system_prompt
          || effectiveSettings.system_prompt_override
          || getDefaultSystemPrompt();

        // Merge agent-level overrides into effective settings when config found
        const mergedSettings = agentConfig ? {
          ...effectiveSettings,
          ai_model_mode: agentConfig.model_mode ?? effectiveSettings.ai_model_mode,
          message_breaking_enabled: agentConfig.message_breaking_enabled ?? effectiveSettings.message_breaking_enabled,
          ai_activation_delay_minutes: agentConfig.ai_activation_delay_minutes ?? effectiveSettings.ai_activation_delay_minutes,
        } : effectiveSettings;

        console.log(`[Nina] Agent selected: ${agentConfig?.name ?? 'nina_settings fallback'} (trigger: ${agentConfig?.trigger_type ?? 'none'})`);

        await processQueueItem(supabase, lovableApiKey, item, systemPrompt, mergedSettings);
        
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

async function handoffToHuman(
  supabase: any,
  conversation: any,
  args: { reason: string; preferred_time?: string }
): Promise<{ success: boolean; error?: string }> {
  console.log('[Nina] Handoff to human requested:', args);

  try {
    const { data: notifSettings } = await supabase
      .from('nina_settings')
      .select('scheduling_notify_commercial, scheduling_notify_phone, evolution_api_url, evolution_api_key, evolution_instance_name, scheduling_notify_evolution_instance')
      .limit(1)
      .single();

    const { data: contact } = await supabase
      .from('contacts')
      .select('name, phone_number, company, tags')
      .eq('id', conversation.contact_id)
      .single();

    // Switch conversation to human mode
    await supabase
      .from('conversations')
      .update({ status: 'human' })
      .eq('id', conversation.id);

    console.log('[Nina] Conversation switched to human mode');

    // Tag the contact
    const currentTags = contact?.tags || [];
    if (!currentTags.includes('DEMO-SOLICITADA')) {
      await supabase
        .from('contacts')
        .update({ tags: [...currentTags, 'DEMO-SOLICITADA'] })
        .eq('id', conversation.contact_id);
    }

    // Send commercial notification
    if (notifSettings?.scheduling_notify_commercial && notifSettings?.scheduling_notify_phone) {
      const instance = notifSettings.scheduling_notify_evolution_instance || notifSettings.evolution_instance_name;

      const notifMessage = `🔔 *Novo Lead Qualificado - PremaCar*

👤 *Nome:* ${contact?.name || 'Sem nome'}
📱 *Telefone:* ${contact?.phone_number}${contact?.company ? `\n🏢 *Empresa:* ${contact.company}` : ''}

📋 *Contexto:*
${args.reason}
${args.preferred_time ? `\n⏰ *Horário preferido:* ${args.preferred_time}` : ''}

👉 *Ação:* Entre em contato via WhatsApp para agendar a demo.

_A conversa já foi transferida para modo humano no sistema._`;

      try {
        const response = await fetch(
          `${notifSettings.evolution_api_url}/message/sendText/${instance}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'apikey': notifSettings.evolution_api_key },
            body: JSON.stringify({
              number: notifSettings.scheduling_notify_phone.replace(/\D/g, ''),
              text: notifMessage
            })
          }
        );

        if (response.ok) {
          console.log('[Nina] Commercial notification sent successfully');
          return { success: true };
        } else {
          console.error('[Nina] Notification send failed:', response.status);
          return { success: true, error: 'notification_failed' };
        }
      } catch (err) {
        console.error('[Nina] Error sending notification:', err);
        return { success: true, error: 'notification_error' };
      }
    } else {
      console.warn('[Nina] Commercial notification not configured — handoff done without notification');
      return { success: true, error: 'not_configured' };
    }
  } catch (err) {
    console.error('[Nina] Error in handoff:', err);
    return { success: false, error: String(err) };
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
  supabase: any, lovableApiKey: string, item: any, systemPrompt: string, settings: any
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  console.log(`[Nina] Processing queue item: ${item.id}`);

  const { data: message } = await supabase.from('messages').select('*').eq('id', item.message_id).maybeSingle();
  if (!message) throw new Error('Message not found');

  const { data: conversation } = await supabase.from('conversations').select('*, contact:contacts(*), calendar_flow').eq('id', item.conversation_id).maybeSingle();
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
  // CALENDAR FLOW: handle ongoing booking state
  // ═══════════════════════════════════════════
  const calendarFlow = conversation.calendar_flow as {
    state?: string;
    offered_slots?: { iso: string; label: string }[];
    selected_slot?: string;
  } | null;

  if (calendarFlow?.state === 'showing_slots') {
    console.log('[Nina] 📅 Calendar flow: showing_slots — parsing slot selection');
    const userText = (message.content || '').trim();
    const slotIndex = parseSlotSelection(userText, calendarFlow.offered_slots?.length || 0);

    if (slotIndex !== null && calendarFlow.offered_slots?.[slotIndex]) {
      const selected = calendarFlow.offered_slots[slotIndex];
      await supabase.from('conversations').update({
        calendar_flow: { ...calendarFlow, state: 'requesting_email', selected_slot: selected.iso }
      }).eq('id', conversation.id);
      await queueCalendarMessage(supabase, conversation, message,
        `Ótimo! Reservei *${selected.label}* para você 🗓️\n\nPara confirmar e enviar o convite, qual é o seu e-mail?`,
        settings);
    } else {
      await queueCalendarMessage(supabase, conversation, message,
        `Digite só o número do horário que prefere:\n\n${(calendarFlow.offered_slots || []).map((s, i) => `${i + 1}. ${s.label}`).join('\n')}`,
        settings);
    }

    await supabase.from('messages').update({
      processed_by_nina: true,
      nina_response_time: Date.now() - new Date(message.sent_at).getTime()
    }).eq('id', message.id);
    return;
  }

  if (calendarFlow?.state === 'requesting_email') {
    console.log('[Nina] 📅 Calendar flow: requesting_email — parsing email');
    const userText = (message.content || '').trim();
    const email = parseEmail(userText);

    if (email && calendarFlow.selected_slot) {
      try {
        const eventResult = await callGoogleCalendarFunction(supabaseUrl, supabaseServiceKey, {
          action: 'create_event',
          user_id: conversation.user_id,
          slot_iso: calendarFlow.selected_slot,
          lead_name: conversation.contact?.name || 'Lead',
          lead_email: email,
          lead_company: conversation.contact?.company || '',
          conversation_id: conversation.id,
          contact_id: conversation.contact_id,
        });

        await supabase.from('conversations').update({ calendar_flow: null }).eq('id', conversation.id);
        await supabase.from('contacts').update({ email }).eq('id', conversation.contact_id);

        const slotLabel = formatSlotLabel(calendarFlow.selected_slot);
        let confirmMsg = `Perfeito! Sua demo está confirmada para *${slotLabel}* 🎉\n\nEnviei um convite para ${email}.`;
        if (eventResult?.meet_link) confirmMsg += `\n\n🔗 Link: ${eventResult.meet_link}`;

        await queueCalendarMessage(supabase, conversation, message, confirmMsg, settings);
      } catch (err) {
        console.error('[Nina] 📅 Calendar event creation failed:', err);
        await supabase.from('conversations').update({ calendar_flow: null }).eq('id', conversation.id);
        await queueCalendarMessage(supabase, conversation, message,
          'Recebi seu e-mail! Nossa equipe vai confirmar o agendamento em breve 😊', settings);
      }
    } else {
      await queueCalendarMessage(supabase, conversation, message,
        'Não reconheci o e-mail. Pode me enviar de novo? (ex: nome@email.com)', settings);
    }

    await supabase.from('messages').update({
      processed_by_nina: true,
      nina_response_time: Date.now() - new Date(message.sent_at).getTime()
    }).eq('id', message.id);
    return;
  }

  // ═══════════════════════════════════════════
  // SCHEDULING AUTO-TRIGGER: Lead respondeu com dia/horário após AI perguntar
  // ═══════════════════════════════════════════
  if (!calendarFlow && aiSettings.ai_scheduling_enabled !== false) {
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
      console.log('[Nina] 📅 SCHEDULING AUTO-TRIGGER: lead respondeu com preferência de horário, iniciando calendar flow diretamente');
      let autoTriggered = false;
      try {
        const slotsResult = await callGoogleCalendarFunction(supabaseUrl, supabaseServiceKey, {
          action: 'available_slots',
          user_id: conversation.user_id,
        });
        const slots: { iso: string; label: string }[] = slotsResult?.slots || [];

        if (slots.length > 0) {
          await supabase.from('conversations').update({
            calendar_flow: { state: 'showing_slots', offered_slots: slots }
          }).eq('id', conversation.id);
          await queueCalendarMessage(supabase, conversation, message, formatSlotsMessage(slots), settings);
          autoTriggered = true;
        } else {
          await queueCalendarMessage(supabase, conversation, message,
            'Perfeito! Vou confirmar os horários e te aviso em instantes 😊', settings);
          autoTriggered = true;
        }
      } catch (err) {
        console.error('[Nina] SCHEDULING AUTO-TRIGGER error — falling through to AI:', err);
      }

      if (autoTriggered) {
        await supabase.from('messages').update({
          processed_by_nina: true,
          nina_response_time: Date.now() - new Date(message.sent_at).getTime()
        }).eq('id', message.id);
        return;
      }
      // Se falhou, continua no fluxo normal da IA abaixo
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
  // AUDIO TRANSCRIPTION: Resolve before sending to AI
  // ═══════════════════════════════════════════
  if (message.type === 'audio') {
    console.log('[Nina] Audio message detected, attempting transcription...');

    // Wait 2s in case the message-grouper is already transcribing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Re-fetch — grouper may have updated the content
    const { data: refreshedMsg } = await supabase
      .from('messages')
      .select('content, media_url')
      .eq('id', message.id)
      .single();

    const currentContent = refreshedMsg?.content || message.content || '';
    const isAlreadyTranscribed =
      currentContent.length > 5 &&
      !currentContent.includes('[áudio') &&
      !currentContent.includes('[audio') &&
      currentContent !== '[áudio recebido]';

    if (isAlreadyTranscribed) {
      message.content = currentContent;
      console.log('[Nina] Grouper already transcribed:', currentContent.substring(0, 50));
    } else {
      const mediaId = refreshedMsg?.media_url || message.media_url;

      if (mediaId) {
        try {
          const { data: audioSettings } = await supabase
            .from('nina_settings')
            .select('meta_access_token, evolution_api_url, evolution_api_key, evolution_instance_name')
            .limit(1)
            .single();

          let audioBuffer: ArrayBuffer | null = null;

          // Try Meta API first
          if (audioSettings?.meta_access_token) {
            try {
              const mediaResp = await fetch(
                `https://graph.facebook.com/v21.0/${mediaId}`,
                { headers: { 'Authorization': `Bearer ${audioSettings.meta_access_token}` } }
              );
              if (mediaResp.ok) {
                const mediaData = await mediaResp.json();
                if (mediaData.url) {
                  const audioResp = await fetch(mediaData.url, {
                    headers: { 'Authorization': `Bearer ${audioSettings.meta_access_token}` }
                  });
                  if (audioResp.ok) {
                    audioBuffer = await audioResp.arrayBuffer();
                    console.log('[Nina] Audio downloaded via Meta API, size:', audioBuffer.byteLength);
                  }
                }
              }
            } catch (metaErr) {
              console.error('[Nina] Meta API download failed:', metaErr);
            }
          }

          // Fallback: Evolution API
          if (!audioBuffer && audioSettings?.evolution_api_url && audioSettings?.evolution_api_key) {
            try {
              const evoResp = await fetch(
                `${audioSettings.evolution_api_url}/chat/getBase64FromMediaMessage/${audioSettings.evolution_instance_name}`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'apikey': audioSettings.evolution_api_key },
                  body: JSON.stringify({ message: { key: { id: mediaId } } })
                }
              );
              if (evoResp.ok) {
                const evoData = await evoResp.json();
                if (evoData.base64) {
                  const binaryStr = atob(evoData.base64);
                  const bytes = new Uint8Array(binaryStr.length);
                  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
                  audioBuffer = bytes.buffer;
                  console.log('[Nina] Audio downloaded via Evolution API');
                }
              }
            } catch (evoErr) {
              console.error('[Nina] Evolution API download failed:', evoErr);
            }
          }

          // Transcribe with Whisper
          if (audioBuffer && audioBuffer.byteLength > 0) {
            const formData = new FormData();
            formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'audio.ogg');
            formData.append('model', 'whisper-1');

            const transcribeResp = await fetch(
              'https://ai.gateway.lovable.dev/v1/audio/transcriptions',
              { method: 'POST', headers: { 'Authorization': `Bearer ${lovableApiKey}` }, body: formData }
            );

            if (transcribeResp.ok) {
              const result = await transcribeResp.json();
              if (result.text) {
                message.content = result.text;
                await supabase.from('messages').update({ content: result.text }).eq('id', message.id);
                console.log('[Nina] Audio transcribed:', result.text.substring(0, 80));
              }
            } else {
              console.error('[Nina] Whisper error:', transcribeResp.status);
              message.content = '[O cliente enviou um áudio que não foi possível transcrever. Responda de forma natural pedindo que repita a informação por texto, sem mencionar problemas técnicos.]';
            }
          } else {
            message.content = '[O cliente enviou um áudio que não foi possível transcrever. Responda de forma natural pedindo que repita a informação por texto, sem mencionar problemas técnicos.]';
          }
        } catch (err) {
          console.error('[Nina] Audio transcription error:', err);
          message.content = '[O cliente enviou um áudio que não foi possível transcrever. Responda de forma natural pedindo que repita a informação por texto, sem mencionar problemas técnicos.]';
        }
      } else {
        message.content = '[O cliente enviou um áudio que não foi possível transcrever. Responda de forma natural pedindo que repita a informação por texto, sem mencionar problemas técnicos.]';
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

  const enhancedSystemPrompt = buildEnhancedPrompt(systemPrompt, conversation.contact, clientMemory, origemConversa, message.content || '');

  // Fetch deal data
  let dealData: any = null;
  try {
    const { data: deal } = await supabase.from('deals').select('*, stage_info:pipeline_stages(title)').eq('contact_id', conversation.contact_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
    dealData = deal;
  } catch (e) { console.log('[Nina] Could not fetch deal data:', e); }

  const { count: totalMessages } = await supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conversation.id);
  const hasHistory = origemConversa?.origem === 'retorno';

  const processedPrompt = processPromptTemplate(enhancedSystemPrompt, conversation.contact, origemConversa, {
    dealData, settings, conversationStatus: conversation.status, totalMessages: totalMessages || 0, hasHistory,
  });

  console.log('[Nina] Calling Lovable AI...');

  const aiSettings = getModelSettings(settings, conversationHistory, message, conversation.contact, clientMemory);

  const tools: any[] = [];
  tools.push(handoffToHumanTool);
  tools.push(updateContactInfoTool);

  const requestBody: any = {
    model: aiSettings.model,
    messages: [
      { role: 'system', content: processedPrompt },
      ...conversationHistory
    ],
    temperature: aiSettings.temperature,
    max_tokens: 1000
  };

  if (tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = "auto";
  }

  const aiResponse = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  });

  if (!aiResponse.ok) {
    const errorText = await aiResponse.text();
    console.error('[Nina] AI response error:', aiResponse.status, errorText);
    if (aiResponse.status === 429) throw new Error('Rate limit exceeded, will retry later');
    if (aiResponse.status === 402) throw new Error('Payment required - please add credits');
    throw new Error(`AI error: ${aiResponse.status}`);
  }

  const aiData = await aiResponse.json();
  const aiMessage = aiData.choices?.[0]?.message;
  let aiContent = aiMessage?.content || '';
  const toolCalls = aiMessage?.tool_calls || [];

  console.log('[Nina] AI response received, content length:', aiContent?.length || 0, ', tool_calls:', toolCalls.length);

  // Process tool calls
  let handoffDone = false;

  for (const toolCall of toolCalls) {
    if (toolCall.function?.name === 'request_demo_handoff') {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        const handoffResult = await handoffToHuman(supabase, conversation, args);

        if (handoffResult.success) {
          aiContent = (aiContent || 'Vou te conectar com um de nossos consultores agora. Eles vão te atender em breve! 😊');
        } else {
          aiContent = (aiContent || 'Vou te passar para nossa equipe. Eles entrarão em contato em breve!');
        }
        handoffDone = true;
      } catch (parseError) {
        console.error('[Nina] Error parsing request_demo_handoff:', parseError);
      }
    }

    if (toolCall.function?.name === 'update_contact_info') {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        await updateContactInfo(supabase, conversation.contact_id, args);
        // Silent action — no message added to aiContent
      } catch (parseError) {
        console.error('[Nina] Error parsing update_contact_info:', parseError);
      }
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
    if (fallbackIntent.has && fallbackIntent.desc.includes('demonstração')) {
      aiContent = 'Ótimo! Vou verificar os horários disponíveis para sua demo agora. [AGENDAR_DEMO]';
    } else {
      aiContent = 'Olá! Como posso ajudar você hoje? 😊';
    }
  }

  // ═══════════════════════════════════════════
  // CALENDAR FLOW: detect [AGENDAR_DEMO] marker
  // ═══════════════════════════════════════════
  let startCalendarFlow = false;
  if (aiContent.includes('[AGENDAR_DEMO]')) {
    // Remove o marcador do conteúdo sempre, mesmo que scheduling esteja desativado
    aiContent = aiContent.replace(/\[AGENDAR_DEMO\]/gi, '').trim();
    if (aiSettings.ai_scheduling_enabled !== false) {
      startCalendarFlow = true;
      console.log('[Nina] 📅 [AGENDAR_DEMO] marker detected — will fetch Google Calendar slots');
    } else {
      console.log('[Nina] 📅 [AGENDAR_DEMO] marker detected but ai_scheduling_enabled=false — skipping calendar flow');
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

  // ═══════════════════════════════════════════
  // CALENDAR FLOW: fetch slots and queue listing
  // ═══════════════════════════════════════════
  if (startCalendarFlow) {
    try {
      const slotsResult = await callGoogleCalendarFunction(supabaseUrl, supabaseServiceKey, {
        action: 'available_slots',
        user_id: conversation.user_id,
      });
      const slots: { iso: string; label: string }[] = slotsResult?.slots || [];

      if (slots.length > 0) {
        await supabase.from('conversations').update({
          calendar_flow: { state: 'showing_slots', offered_slots: slots }
        }).eq('id', conversation.id);

        // Use queueCalendarMessage so whatsapp-sender is triggered after the AI text is sent
        await queueCalendarMessage(supabase, conversation, message, formatSlotsMessage(slots), settings);
        console.log('[Nina] 📅 Calendar slots queued and sender triggered, state: showing_slots');
      } else {
        console.warn('[Nina] 📅 No available calendar slots — flow aborted');
      }
    } catch (err) {
      console.error('[Nina] 📅 Calendar flow start error:', err);
    }
  }
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
// GOOGLE CALENDAR HELPERS
// ═══════════════════════════════════════════

async function callGoogleCalendarFunction(
  supabaseUrl: string, serviceKey: string, payload: Record<string, any>
): Promise<any> {
  const res = await fetch(`${supabaseUrl}/functions/v1/google-calendar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`google-calendar: ${res.status} — ${errText.substring(0, 200)}`);
  }
  return res.json();
}

function formatSlotsMessage(slots: { iso: string; label: string }[]): string {
  const lines = slots.map((s, i) => `${i + 1}. ${s.label}`).join('\n');
  return `Aqui estão os horários disponíveis para a demo 📅\n\n${lines}\n\nQual horário fica melhor pra você? É só digitar o número.`;
}

function formatSlotLabel(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      weekday: 'long', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return isoString;
  }
}

function parseSlotSelection(text: string, slotCount: number): number | null {
  const t = text.trim();
  const numMatch = t.match(/^(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= slotCount) return n - 1;
  }
  const wordMap: Record<string, number> = {
    'primeiro': 0, 'segunda': 0, 'segundo': 1, 'terceiro': 2, 'terceira': 2,
    'quarto': 3, 'quarta': 3, 'quinto': 4, 'quinta': 4,
    'um': 0, 'dois': 1, 'três': 2, 'quatro': 3, 'cinco': 4,
  };
  for (const [word, idx] of Object.entries(wordMap)) {
    if (t.toLowerCase().includes(word) && idx < slotCount) return idx;
  }
  return null;
}

function parseEmail(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

async function queueCalendarMessage(
  supabase: any, conversation: any, triggerMessage: any,
  content: string, settings: any, extraDelayMs = 0
): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const delay = (settings?.response_delay_min || 1000) + extraDelayMs;

  await supabase.from('send_queue').insert({
    conversation_id: conversation.id,
    contact_id: conversation.contact_id,
    content,
    from_type: 'nina',
    message_type: 'text',
    priority: 1,
    scheduled_at: new Date(Date.now() + delay).toISOString(),
    metadata: { response_to_message_id: triggerMessage.id, calendar_flow: true }
  });

  await supabase.rpc('mark_ai_message_sent', {
    p_conversation_id: conversation.id,
    p_content: content.substring(0, 500),
  });

  await new Promise(resolve => setTimeout(resolve, delay + 500));
  fetch(`${supabaseUrl}/functions/v1/whatsapp-sender`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
    body: JSON.stringify({ triggered_by: 'nina-orchestrator-calendar' }),
  }).catch(err => console.error('[Nina] Calendar sender trigger failed:', err));
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
- Quando o lead CONFIRMAR que quer agendar, inclua exatamente [AGENDAR_DEMO] em sua resposta
- Exemplo: "Que ótimo! Vou verificar os horários disponíveis agora. [AGENDAR_DEMO]"
- O sistema buscará horários no Google Calendar e enviará a lista automaticamente
- NÃO inclua [AGENDAR_DEMO] se o lead ainda não confirmou interesse em agendar
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
    
    if (conversasComInteracao > 0 || userMessagesInConversation > 3) {
      return { origem: 'retorno', detalhes: `Cliente com ${conversasComInteracao} conversa(s) anterior(es). Seja natural.` };
    }
    
    return { origem: 'inbound', detalhes: 'Primeiro contato. Apresente-se e faça perguntas de descoberta.' };
    
  } catch (error) {
    console.error('[Nina] Erro ao detectar origem:', error);
    return { origem: 'inbound', detalhes: 'Não foi possível detectar origem.' };
  }
}

function processPromptTemplate(
  prompt: string, contact: any, origemConversa?: { origem: string; detalhes: string },
  extraContext?: { dealData?: any; settings?: any; conversationStatus?: string; totalMessages?: number; hasHistory?: boolean; }
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

function buildEnhancedPrompt(basePrompt: string, contact: any, memory: any, origemConversa?: { origem: string; detalhes: string }, latestUserMessage = ''): string {
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
- Se quiser agendar demo: confirme o interesse, colete tipo de estabelecimento (se ainda não tem), e quando tiver informação suficiente, inclua [AGENDAR_DEMO] na resposta
- Seja objetivo e mostre que entendeu o pedido
</intencao_explicita>`;
  }

  const antiDoubleMessageInstruction = `

INSTRUÇÃO CRÍTICA DE FORMATO:
- Responda com APENAS 1 mensagem curta
- NUNCA envie 2 perguntas ou 2 blocos de texto separados
- Se precisar fazer uma pergunta, faça APENAS 1
- Não use duplo Enter (parágrafo duplo) para separar ideias diferentes
- Use Enter simples se precisar de quebra de linha
- NUNCA adicione "(opcional)", "(se quiser)" ou qualificadores entre parênteses nas mensagens`;

  return basePrompt + contextInfo + antiDoubleMessageInstruction;
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

function getModelSettings(settings: any, conversationHistory: any[], message: any, contact: any, clientMemory: any): { model: string; temperature: number } {
  const modelMode = settings?.ai_model_mode || 'flash';
  
  switch (modelMode) {
    case 'flash': return { model: 'google/gemini-2.5-flash', temperature: 0.7 };
    case 'pro': return { model: 'google/gemini-2.5-pro', temperature: 0.7 };
    case 'pro3': return { model: 'google/gemini-3-pro-preview', temperature: 0.7 };
    case 'adaptive': return getAdaptiveSettings(conversationHistory, message, contact, clientMemory);
    default: return { model: 'google/gemini-2.5-flash', temperature: 0.7 };
  }
}

function getAdaptiveSettings(conversationHistory: any[], message: any, contact: any, clientMemory: any): { model: string; temperature: number } {
  const messageCount = conversationHistory.length;
  const userContent = message.content?.toLowerCase() || '';
  
  const isComplaintKeywords = ['problema', 'erro', 'não funciona', 'reclamação', 'péssimo', 'horrível'];
  const isSalesKeywords = ['preço', 'valor', 'desconto', 'comprar', 'contratar', 'plano'];
  const isTechnicalKeywords = ['como funciona', 'integração', 'api', 'configurar', 'instalar'];
  const isUrgentKeywords = ['urgente', 'agora', 'rápido', 'emergência'];

  const isComplaint = isComplaintKeywords.some(k => userContent.includes(k));
  const isSales = isSalesKeywords.some(k => userContent.includes(k));
  const isTechnical = isTechnicalKeywords.some(k => userContent.includes(k));
  const isUrgent = isUrgentKeywords.some(k => userContent.includes(k));
  
  const qualificationScore = clientMemory?.lead_profile?.qualification_score || 0;

  if (isComplaint || isUrgent) return { model: 'google/gemini-2.5-pro', temperature: 0.3 };
  if (isSales && qualificationScore > 50) return { model: 'google/gemini-2.5-flash', temperature: 0.5 };
  if (isTechnical) return { model: 'google/gemini-2.5-pro', temperature: 0.4 };
  if (messageCount < 5) return { model: 'google/gemini-2.5-flash', temperature: 0.8 };
  if (messageCount > 15) return { model: 'google/gemini-2.5-flash', temperature: 0.5 };

  return { model: 'google/gemini-2.5-flash', temperature: 0.7 };
}
