import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeSingleAction, AutomationActionDef } from "../_shared/automation-actions.ts";

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
  actions: AutomationActionDef[];
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
  actions: AutomationActionDef[],
  context: Record<string, any>,
  chainDepth: number,
  supabaseUrl: string,
  supabaseServiceKey: string
) {
  const results: Array<{ type: string; success: boolean; error?: string }> = [];

  for (const action of actions) {
    if (action.delay_hours && action.delay_hours > 0) {
      // Ação com delay: não executa agora — enfileira pro
      // automation-delayed-processor rodar no horário certo.
      try {
        const runAt = new Date(Date.now() + action.delay_hours * 3_600_000).toISOString();
        const { error } = await supabase.from('automation_delayed_actions').insert({
          contact_id: context.contact?.id || null,
          conversation_id: context.conversation_id || null,
          deal_id: context.deal?.id || null,
          action: { type: action.type, params: action.params },
          run_at: runAt,
          chain_depth: chainDepth,
        });
        if (error) throw error;
        results.push({ type: action.type, success: true });
      } catch (scheduleError) {
        const message = scheduleError instanceof Error ? scheduleError.message : 'Erro desconhecido';
        console.error(`[AutomationExecutor] Erro ao agendar ação ${action.type}:`, message);
        results.push({ type: action.type, success: false, error: message });
      }
      continue;
    }

    const result = await executeSingleAction(supabase, action, context, chainDepth, supabaseUrl, supabaseServiceKey);
    results.push(result);
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
