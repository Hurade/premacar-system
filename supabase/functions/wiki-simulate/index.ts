import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callAIProvider, type AIProviderMessage, type AIProviderRow } from "../_shared/ai-providers.ts";
import { requireAuth } from "../_shared/auth.ts";
import { buildSimulatorCustomerPrompt, buildSimulatorEvaluatorPrompt } from "../_shared/wiki-prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TranscriptTurn {
  role: 'customer' | 'user';
  content: string;
  at: string;
}

type SimulateBody =
  | { action: 'start'; roleplay_id: string }
  | { action: 'turn'; session_id: string; message: string }
  | { action: 'evaluate'; session_id: string };

async function getProvider(supabase: any): Promise<AIProviderRow | null> {
  const { data } = await supabase.from('ai_providers').select('*').eq('is_default', true).eq('is_active', true).maybeSingle();
  return data as AIProviderRow | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { auth, response } = await requireAuth(req, corsHeaders);
  if (response) return response;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = (await req.json()) as SimulateBody;

    if (body.action === 'start') {
      const { data: roleplay, error: rpError } = await supabase
        .from('wiki_roleplays').select('*').eq('id', body.roleplay_id).maybeSingle();
      if (rpError || !roleplay) {
        return new Response(JSON.stringify({ success: false, error: 'Roleplay não encontrado' }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const transcript: TranscriptTurn[] = [{ role: 'customer', content: roleplay.customer_opening, at: new Date().toISOString() }];
      const { data: session, error } = await supabase.from('wiki_simulator_sessions').insert({
        user_id: auth!.userId,
        roleplay_id: roleplay.id,
        transcript,
      }).select('id').single();
      if (error || !session) throw new Error(error?.message || 'Falha ao criar sessão');

      return new Response(JSON.stringify({ success: true, session_id: session.id, opening: roleplay.customer_opening }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === 'turn') {
      const { data: session, error: sError } = await supabase
        .from('wiki_simulator_sessions').select('*, roleplay:wiki_roleplays(*)').eq('id', body.session_id).maybeSingle();
      if (sError || !session) {
        return new Response(JSON.stringify({ success: false, error: 'Sessão não encontrada' }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const provider = await getProvider(supabase);
      if (!provider) throw new Error('Nenhum provedor de IA ativo configurado');

      const transcript: TranscriptTurn[] = [...(session.transcript || []), { role: 'user', content: body.message, at: new Date().toISOString() }];
      const messages: AIProviderMessage[] = transcript.map((t) => ({
        role: t.role === 'customer' ? 'assistant' : 'user',
        content: t.content,
      }));

      const result = await callAIProvider(provider, {
        systemPrompt: buildSimulatorCustomerPrompt(session.roleplay),
        messages,
        model: provider.fast_model,
        temperature: 0.8,
        maxTokens: 400,
      });
      const reply = result.content || '...';
      transcript.push({ role: 'customer', content: reply, at: new Date().toISOString() });

      await supabase.from('wiki_simulator_sessions').update({ transcript }).eq('id', session.id);

      return new Response(JSON.stringify({ success: true, reply, transcript }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === 'evaluate') {
      const { data: session, error: sError } = await supabase
        .from('wiki_simulator_sessions').select('*, roleplay:wiki_roleplays(*)').eq('id', body.session_id).maybeSingle();
      if (sError || !session) {
        return new Response(JSON.stringify({ success: false, error: 'Sessão não encontrada' }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const provider = await getProvider(supabase);
      if (!provider) throw new Error('Nenhum provedor de IA ativo configurado');

      const transcriptText = (session.transcript as TranscriptTurn[])
        .map((t) => `${t.role === 'customer' ? 'Cliente' : 'Atendente'}: ${t.content}`).join('\n');

      const result = await callAIProvider(provider, {
        systemPrompt: buildSimulatorEvaluatorPrompt(session.roleplay),
        messages: [{ role: 'user', content: `Transcrição da conversa:\n\n${transcriptText}` }],
        model: provider.smart_model,
        temperature: 0.2,
        maxTokens: 700,
      });

      let evaluation: { score: number; criteria_met: unknown; feedback: string };
      try {
        evaluation = JSON.parse(result.content);
      } catch {
        evaluation = { score: 0, criteria_met: [], feedback: 'Não foi possível interpretar a avaliação da IA — tente novamente.' };
      }

      await supabase.from('wiki_simulator_sessions').update({
        status: 'evaluated',
        score: evaluation.score,
        evaluation: evaluation.feedback,
        criteria_met: evaluation.criteria_met,
        finished_at: new Date().toISOString(),
      }).eq('id', session.id);

      return new Response(JSON.stringify({ success: true, ...evaluation }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "action deve ser 'start', 'turn' ou 'evaluate'" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error('[WikiSimulate] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
