import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateEmbedding } from "../_shared/embeddings.ts";
import { callAIProvider, type AIProviderMessage, type AIProviderRow } from "../_shared/ai-providers.ts";
import { requireAuth } from "../_shared/auth.ts";
import { buildWikiAskSystemPrompt, type WikiAgent } from "../_shared/wiki-prompts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AGENT_AREA: Record<WikiAgent, string | null> = {
  max: 'Suporte',
  clara: 'CS',
  tutor: null, // Tutor respeita o `area` do body, ou busca em todas
};

interface AskBody {
  agent: WikiAgent;
  area?: string | null;
  question: string;
  history?: AIProviderMessage[];
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
    const body = (await req.json()) as AskBody;
    if (!body.agent || !['max', 'clara', 'tutor'].includes(body.agent)) {
      return new Response(JSON.stringify({ success: false, error: "agent deve ser 'max', 'clara' ou 'tutor'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!body.question?.trim()) {
      return new Response(JSON.stringify({ success: false, error: "question é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resolvedArea = body.agent === 'tutor' ? (body.area ?? null) : AGENT_AREA[body.agent];

    const embedding = await generateEmbedding(body.question, 'query');
    let matches: any[] = [];
    if (embedding) {
      const { data, error } = await supabase.rpc('match_wiki_articles', {
        query_embedding: embedding,
        match_threshold: 0.75,
        match_count: 6,
        p_area: resolvedArea,
      });
      if (error) console.error('[WikiAsk] Erro em match_wiki_articles:', error);
      else matches = data || [];
    }
    const isGap = matches.length === 0;

    const { data: provider } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();

    let answer: string;
    if (!provider) {
      answer = 'Não há um provedor de IA configurado no momento — fale com um administrador do sistema.';
    } else {
      const systemPrompt = buildWikiAskSystemPrompt(body.agent, matches);
      const messages: AIProviderMessage[] = [...(body.history || []), { role: 'user', content: body.question }];
      const result = await callAIProvider(provider as AIProviderRow, {
        systemPrompt,
        messages,
        model: (provider as AIProviderRow).smart_model,
        temperature: 0.3,
        maxTokens: 900,
      });
      answer = result.content || 'Não consegui gerar uma resposta agora — tente novamente.';
    }

    const { data: queryRow } = await supabase.from('wiki_ai_queries').insert({
      user_id: auth?.userId ?? null,
      agent: body.agent,
      area_filter: resolvedArea,
      question: body.question,
      answer,
      matched_article_ids: matches.map((m) => m.id),
      best_similarity: matches[0]?.similarity ?? null,
      is_gap: isGap,
    }).select('id').single();

    return new Response(JSON.stringify({
      success: true,
      query_id: queryRow?.id ?? null,
      answer,
      sources: matches.map((m) => ({ id: m.id, source_id: m.source_id, title: m.title, area: m.area, system: m.system })),
      is_gap: isGap,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error('[WikiAsk] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
