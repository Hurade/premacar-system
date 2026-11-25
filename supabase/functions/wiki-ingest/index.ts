import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateEmbeddingsBatch } from "../_shared/embeddings.ts";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMBEDDING_BATCH_SIZE = 20;
const VALID_FILES = ['comercial', 'institucional', 'suporte', 'cs'] as const;
type WikiFile = typeof VALID_FILES[number];

interface SourceArticle {
  id: string;
  title: string;
  system: string;
  area: string;
  category?: string;
  description: string;
  causes?: string[];
  steps?: string[];
  observations?: string[];
  tools?: string[];
  escalate?: string;
  tags?: string[];
  source?: string;
}
interface SourceQuiz {
  area: string;
  q: string;
  options: string[];
  answer: number;
  explain?: string;
  articleId?: string;
}
interface SourceRoleplay {
  id: string;
  title: string;
  area: string;
  persona: string;
  context: string;
  objective: string;
  customerOpening: string;
  successCriteria?: string[];
}
interface SourceModule {
  track: string;
  title: string;
  summary?: string;
  articleIds: string[];
}
interface IngestBody {
  file: WikiFile;
  data: {
    articles?: SourceArticle[];
    quiz?: SourceQuiz[];
    roleplays?: SourceRoleplay[];
    modules?: SourceModule[];
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { auth, response } = await requireAdmin(req, corsHeaders);
  if (response) return response;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = (await req.json()) as IngestBody;
    if (!body.file || !VALID_FILES.includes(body.file)) {
      return new Response(JSON.stringify({ success: false, error: `file deve ser um de: ${VALID_FILES.join(', ')}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { file, data } = body;
    const warnings: string[] = [];

    // 1) Artigos — upsert por source_id, embedding gerado em lotes.
    const articles = data.articles || [];
    let articlesUpserted = 0;
    for (let i = 0; i < articles.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = articles.slice(i, i + EMBEDDING_BATCH_SIZE);
      const texts = batch.map((a) =>
        [a.title, a.description, (a.steps || []).join('\n'), (a.observations || []).join('\n')]
          .filter(Boolean).join('\n')
      );
      const embeddings = await generateEmbeddingsBatch(texts, 'passage');

      for (let idx = 0; idx < batch.length; idx++) {
        const a = batch[idx];
        const { error } = await supabase.from('wiki_articles').upsert({
          source_id: a.id,
          title: a.title,
          system: a.system,
          area: a.area,
          category: a.category ?? null,
          description: a.description,
          causes: a.causes || [],
          steps: a.steps || [],
          observations: a.observations || [],
          tools: a.tools || [],
          escalate: a.escalate ?? null,
          tags: a.tags || [],
          source_file: a.source ?? file,
          embedding: embeddings[idx],
          is_active: true,
        }, { onConflict: 'source_id' });
        if (error) {
          warnings.push(`artigo ${a.id}: ${error.message}`);
        } else {
          articlesUpserted++;
        }
      }
    }

    // 2) Roleplays — upsert por source_id.
    const roleplays = data.roleplays || [];
    let roleplaysUpserted = 0;
    for (const rp of roleplays) {
      const { error } = await supabase.from('wiki_roleplays').upsert({
        source_id: rp.id,
        title: rp.title,
        area: rp.area,
        persona: rp.persona,
        context: rp.context,
        objective: rp.objective,
        customer_opening: rp.customerOpening,
        success_criteria: rp.successCriteria || [],
      }, { onConflict: 'source_id' });
      if (error) warnings.push(`roleplay ${rp.id}: ${error.message}`);
      else roleplaysUpserted++;
    }

    // 3) Quiz — chave posicional (sem id autoral no JSON), resolve articleId
    //    consultando a tabela já atualizada no passo 1.
    const quiz = data.quiz || [];
    let quizUpserted = 0;
    for (let i = 0; i < quiz.length; i++) {
      const q = quiz[i];
      let articleId: string | null = null;
      if (q.articleId) {
        const { data: art } = await supabase.from('wiki_articles').select('id').eq('source_id', q.articleId).maybeSingle();
        if (art) articleId = art.id;
        else warnings.push(`quiz ${file}:quiz:${i}: articleId '${q.articleId}' não encontrado em wiki_articles`);
      }
      const { error } = await supabase.from('wiki_quiz_questions').upsert({
        source_key: `${file}:quiz:${i}`,
        area: q.area,
        question: q.q,
        options: q.options,
        correct_index: q.answer,
        explanation: q.explain ?? null,
        article_id: articleId,
        article_source_id: q.articleId ?? null,
      }, { onConflict: 'source_key' });
      if (error) warnings.push(`quiz ${file}:quiz:${i}: ${error.message}`);
      else quizUpserted++;
    }

    // 4) Módulos — upsert por source_key, depois recria a membresia ordenada.
    const modules = data.modules || [];
    let modulesUpserted = 0;
    for (let i = 0; i < modules.length; i++) {
      const m = modules[i];
      const { data: moduleRow, error } = await supabase.from('wiki_modules').upsert({
        source_key: `${file}:module:${i}`,
        track: m.track,
        title: m.title,
        summary: m.summary ?? null,
        order_index: i,
      }, { onConflict: 'source_key' }).select('id').single();

      if (error || !moduleRow) {
        warnings.push(`módulo ${file}:module:${i}: ${error?.message || 'falha ao upsert'}`);
        continue;
      }
      modulesUpserted++;

      await supabase.from('wiki_module_articles').delete().eq('module_id', moduleRow.id);

      const articleRows: { module_id: string; article_id: string; order_index: number }[] = [];
      for (let j = 0; j < (m.articleIds || []).length; j++) {
        const { data: art } = await supabase.from('wiki_articles').select('id').eq('source_id', m.articleIds[j]).maybeSingle();
        if (art) {
          articleRows.push({ module_id: moduleRow.id, article_id: art.id, order_index: j });
        } else {
          warnings.push(`módulo ${file}:module:${i}: articleId '${m.articleIds[j]}' não encontrado em wiki_articles`);
        }
      }
      if (articleRows.length > 0) {
        const { error: linkError } = await supabase.from('wiki_module_articles').insert(articleRows);
        if (linkError) warnings.push(`módulo ${file}:module:${i} (vínculo de artigos): ${linkError.message}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      counts: { articles: articlesUpserted, quiz: quizUpserted, roleplays: roleplaysUpserted, modules: modulesUpserted },
      warnings,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error('[WikiIngest] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
