import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { executeSingleAction } from "../_shared/automation-actions.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: dueActions, error } = await supabase
      .from('automation_delayed_actions')
      .select('*')
      .eq('status', 'pending')
      .lte('run_at', new Date().toISOString())
      .order('run_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    if (!dueActions || dueActions.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    for (const row of dueActions) {
      try {
        const context = await buildContext(supabase, row);
        const result = await executeSingleAction(
          supabase,
          row.action,
          context,
          // chain_depth resetado: esta ação já está separada por horas/dias
          // reais do gatilho original — não é um loop síncrono, o limite de
          // profundidade existe pra barrar esse outro caso.
          0,
          supabaseUrl,
          supabaseServiceKey
        );
        if (result.success) {
          await supabase
            .from('automation_delayed_actions')
            .update({ status: 'executed', executed_at: new Date().toISOString() })
            .eq('id', row.id);
        } else {
          await supabase
            .from('automation_delayed_actions')
            .update({ status: 'failed', executed_at: new Date().toISOString(), error_message: result.error || null })
            .eq('id', row.id);
        }
        processed++;
      } catch (rowError) {
        const message = rowError instanceof Error ? rowError.message : 'Erro desconhecido';
        console.error(`[automation-delayed-processor] Erro ao processar ${row.id}:`, message);
        await supabase
          .from('automation_delayed_actions')
          .update({ status: 'failed', executed_at: new Date().toISOString(), error_message: message })
          .eq('id', row.id)
          .catch(() => {});
      }
    }

    return new Response(JSON.stringify({ processed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[automation-delayed-processor] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Busca contact/deal FRESCOS (não um snapshot antigo) — importante pro
// apply_tag encadear corretamente com o estado atual de tags do contato.
async function buildContext(supabase: any, row: any) {
  const context: Record<string, any> = {
    contact: null,
    deal: null,
    conversation_id: row.conversation_id || null,
  };

  if (row.contact_id) {
    const { data: contact } = await supabase.from('contacts').select('*').eq('id', row.contact_id).maybeSingle();
    context.contact = contact;
  }
  if (row.deal_id) {
    const { data: deal } = await supabase.from('deals').select('*').eq('id', row.deal_id).maybeSingle();
    context.deal = deal;
  }

  return context;
}
