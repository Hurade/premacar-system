import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_CHAIN_DEPTH = 3;

interface ExecutorPayload {
  event_type: 'new_message' | 'tag_applied' | 'stage_changed';
  contact_id?: string;
  conversation_id?: string;
  deal_id?: string;
  message_content?: string;
  tags?: string[]; // tags recém-aplicadas (para trigger_type = tag_applied)
  from_stage_id?: string;
  to_stage_id?: string; // para trigger_type = stage_changed
  chain_depth?: number; // profundidade de encadeamento (ação de uma regra disparando outra)
}

interface Condition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'is_empty';
  value: unknown;
}

interface AutomationRule {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, unknown>;
  conditions: Condition[];
  conditions_logic: 'AND' | 'OR';
  actions: Array<{ type: string; params: Record<string, unknown> }>;
  priority: number;
  run_once_per_contact: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const payload: ExecutorPayload = await req.json();
    const chainDepth = payload.chain_depth || 0;

    if (chainDepth > MAX_CHAIN_DEPTH) {
      console.warn('[AutomationExecutor] Profundidade máxima de encadeamento atingida, abortando:', payload);
      return new Response(JSON.stringify({ skipped: true, reason: 'max_chain_depth' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: rules, error: rulesError } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('trigger_type', payload.event_type)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const context = await buildContext(supabase, payload);
    let processed = 0;

    for (const rule of rules as AutomationRule[]) {
      try {
        if (!matchesTriggerConfig(rule, payload)) continue;

        if (rule.run_once_per_contact && payload.contact_id) {
          const { data: alreadyRan } = await supabase
            .from('automation_rule_runs')
            .select('rule_id')
            .eq('rule_id', rule.id)
            .eq('contact_id', payload.contact_id)
            .maybeSingle();
          if (alreadyRan) continue;
        }

        const conditionsPass = evaluateConditions(rule.conditions || [], rule.conditions_logic, context);

        if (!conditionsPass) {
          await logExecution(supabase, rule.id, payload, context, false, null, 'skipped');
          continue;
        }

        const actionsResult = await executeActions(supabase, rule.actions || [], context, chainDepth, supabaseUrl, supabaseServiceKey);
        await logExecution(supabase, rule.id, payload, context, true, actionsResult, 'success');

        if (rule.run_once_per_contact && payload.contact_id) {
          await supabase.from('automation_rule_runs').insert({ rule_id: rule.id, contact_id: payload.contact_id }).select();
        }

        processed++;
      } catch (ruleError) {
        const message = ruleError instanceof Error ? ruleError.message : 'Erro desconhecido';
        console.error(`[AutomationExecutor] Erro na regra ${rule.id}:`, message);
        await logExecution(supabase, rule.id, payload, context, null, null, 'error', message);
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[AutomationExecutor] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Contexto usado tanto pelo avaliador de condições quanto pelas ações
async function buildContext(supabase: any, payload: ExecutorPayload) {
  const context: Record<string, any> = {
    message: { content: payload.message_content || '' },
    contact: null,
    deal: null,
    conversation_id: payload.conversation_id || null,
  };

  if (payload.contact_id) {
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', payload.contact_id).maybeSingle();
    context.contact = contact;

    if (!context.conversation_id) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('contact_id', payload.contact_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      context.conversation_id = conv?.id || null;
    }
  }

  if (payload.deal_id) {
    const { data: deal } = await supabase.from('deals').select('*').eq('id', payload.deal_id).maybeSingle();
    context.deal = deal;
  } else if (payload.contact_id) {
    const { data: deal } = await supabase
      .from('deals')
      .select('*')
      .eq('contact_id', payload.contact_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    context.deal = deal;
  }

  context.tags_applied = payload.tags || [];
  context.to_stage_id = payload.to_stage_id || null;
  context.from_stage_id = payload.from_stage_id || null;

  return context;
}

function matchesTriggerConfig(rule: AutomationRule, payload: ExecutorPayload): boolean {
  const config = rule.trigger_config || {};

  if (rule.trigger_type === 'tag_applied' && config.tag) {
    return (payload.tags || []).includes(config.tag as string);
  }

  if (rule.trigger_type === 'stage_changed' && config.to_stage_id) {
    return payload.to_stage_id === config.to_stage_id;
  }

  return true; // sem filtro adicional no gatilho (ex.: new_message sempre "casa")
}

function resolveField(field: string, context: Record<string, any>): unknown {
  const parts = field.split('.');
  let value: any = context;
  for (const part of parts) {
    if (value == null) return undefined;
    value = value[part];
  }
  return value;
}

function evaluateCondition(condition: Condition, context: Record<string, any>): boolean {
  const actual = resolveField(condition.field, context);

  switch (condition.operator) {
    case 'equals':
      return actual === condition.value;
    case 'not_equals':
      return actual !== condition.value;
    case 'contains':
      if (Array.isArray(actual)) return actual.includes(condition.value);
      return typeof actual === 'string' && actual.includes(String(condition.value));
    case 'not_contains':
      if (Array.isArray(actual)) return !actual.includes(condition.value);
      return typeof actual === 'string' && !actual.includes(String(condition.value));
    case 'greater_than':
      return typeof actual === 'number' && actual > Number(condition.value);
    case 'less_than':
      return typeof actual === 'number' && actual < Number(condition.value);
    case 'in':
      return Array.isArray(condition.value) && (condition.value as unknown[]).includes(actual);
    case 'is_empty':
      return actual === null || actual === undefined || actual === '' || (Array.isArray(actual) && actual.length === 0);
    default:
      return false;
  }
}

function evaluateConditions(conditions: Condition[], logic: 'AND' | 'OR', context: Record<string, any>): boolean {
  if (!conditions || conditions.length === 0) return true;
  const results = conditions.map((c) => evaluateCondition(c, context));
  return logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

async function executeActions(
  supabase: any,
  actions: Array<{ type: string; params: Record<string, unknown> }>,
  context: Record<string, any>,
  chainDepth: number,
  supabaseUrl: string,
  supabaseServiceKey: string
) {
  const results: Array<{ type: string; success: boolean; error?: string }> = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'send_message': {
          if (!context.conversation_id || !context.contact?.id) {
            throw new Error('Sem conversa/contato para enviar mensagem');
          }
          const { error } = await supabase.from('send_queue').insert({
            conversation_id: context.conversation_id,
            contact_id: context.contact.id,
            message_type: 'text',
            from_type: 'nina',
            content: String(action.params.message || ''),
            priority: 2,
          });
          if (error) throw error;
          break;
        }
        case 'apply_tag':
        case 'remove_tag': {
          if (!context.contact?.id) throw new Error('Sem contato para aplicar/remover tag');
          const tag = String(action.params.tag || '');
          const currentTags: string[] = context.contact.tags || [];
          const nextTags =
            action.type === 'apply_tag'
              ? currentTags.includes(tag) ? currentTags : [...currentTags, tag]
              : currentTags.filter((t) => t !== tag);
          const { error } = await supabase.from('contacts').update({ tags: nextTags }).eq('id', context.contact.id);
          if (error) throw error;
          context.contact.tags = nextTags;

          // Encadeamento controlado: uma automação de tag pode disparar outra,
          // até MAX_CHAIN_DEPTH níveis, evitando loop infinito.
          if (action.type === 'apply_tag') {
            fetch(`${supabaseUrl}/functions/v1/automation-executor`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
              body: JSON.stringify({
                event_type: 'tag_applied',
                contact_id: context.contact.id,
                conversation_id: context.conversation_id,
                tags: [tag],
                chain_depth: chainDepth + 1,
              }),
            }).catch((err) => console.error('[AutomationExecutor] Erro ao encadear tag_applied:', err));
          }
          break;
        }
        case 'move_stage': {
          if (!context.deal?.id) throw new Error('Sem deal para mover de estágio');
          const stageId = String(action.params.stage_id || '');
          const { data: stage } = await supabase.from('pipeline_stages').select('title').eq('id', stageId).maybeSingle();
          const { error } = await supabase
            .from('deals')
            .update({ stage_id: stageId, stage: stage?.title || null, updated_at: new Date().toISOString() })
            .eq('id', context.deal.id);
          if (error) throw error;
          break;
        }
        case 'create_task': {
          if (!context.deal?.id) throw new Error('Sem deal para criar tarefa');
          const { error } = await supabase.from('deal_activities').insert({
            deal_id: context.deal.id,
            type: 'task',
            title: String(action.params.title || 'Tarefa automática'),
            description: action.params.description ? String(action.params.description) : null,
            scheduled_at: action.params.scheduled_at || null,
          });
          if (error) throw error;
          break;
        }
        default:
          throw new Error(`Tipo de ação desconhecido: ${action.type}`);
      }
      results.push({ type: action.type, success: true });
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : 'Erro desconhecido';
      console.error(`[AutomationExecutor] Erro na ação ${action.type}:`, message);
      results.push({ type: action.type, success: false, error: message });
    }
  }

  return results;
}

async function logExecution(
  supabase: any,
  ruleId: string,
  payload: ExecutorPayload,
  context: Record<string, any>,
  conditionsResult: boolean | null,
  actionsResult: unknown,
  status: 'success' | 'partial' | 'error' | 'skipped',
  errorMessage?: string
) {
  try {
    await supabase.from('automation_execution_logs').insert({
      rule_id: ruleId,
      contact_id: payload.contact_id || null,
      conversation_id: context.conversation_id || null,
      deal_id: payload.deal_id || context.deal?.id || null,
      trigger_payload: payload,
      conditions_result: conditionsResult,
      actions_result: actionsResult,
      status,
      error_message: errorMessage || null,
    });
  } catch (logError) {
    console.error('[AutomationExecutor] Erro ao gravar log de execução:', logError);
  }
}
