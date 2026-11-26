// Gera SQL de upsert direto (sem embedding ainda) pra popular a Wiki a
// partir dos 4 JSON de origem, via Management API (que eu já tenho acesso
// de sobra pra usar) — embedding fica NULL até o wiki-ingest (edge
// function) rodar de verdade com a service_role key do usuário, que
// preenche só a coluna embedding sem tocar no resto (upsert não atualiza
// embedding, então não tem conflito entre os dois caminhos).
const fs = require('fs');
const path = require('path');

const SRC_DIR = 'c:/VScode/Prema/Central/_fontes';
const OUT_DIR = __dirname;
const FILES = ['comercial', 'institucional', 'suporte', 'cs'];

function esc(s) {
  return String(s ?? '').replace(/'/g, "''");
}
function sqlStr(s) {
  return `'${esc(s)}'`;
}
function sqlStrOrNull(s) {
  return s == null ? 'NULL' : sqlStr(s);
}
function sqlArray(arr) {
  if (!arr || arr.length === 0) return 'ARRAY[]::text[]';
  return 'ARRAY[' + arr.map((s) => sqlStr(s)).join(',') + ']::text[]';
}

for (const file of FILES) {
  const data = JSON.parse(fs.readFileSync(path.join(SRC_DIR, `${file}.json`), 'utf8'));
  const lines = [];

  // Artigos
  for (const a of data.articles || []) {
    lines.push(`INSERT INTO public.wiki_articles (source_id, title, system, area, category, description, causes, steps, observations, tools, escalate, tags, source_file, is_active) VALUES (${sqlStr(a.id)}, ${sqlStr(a.title)}, ${sqlStr(a.system)}, ${sqlStr(a.area)}, ${sqlStrOrNull(a.category)}, ${sqlStr(a.description)}, ${sqlArray(a.causes)}, ${sqlArray(a.steps)}, ${sqlArray(a.observations)}, ${sqlArray(a.tools)}, ${sqlStrOrNull(a.escalate)}, ${sqlArray(a.tags)}, ${sqlStrOrNull(a.source || file)}, true) ON CONFLICT (source_id) DO UPDATE SET title=EXCLUDED.title, system=EXCLUDED.system, area=EXCLUDED.area, category=EXCLUDED.category, description=EXCLUDED.description, causes=EXCLUDED.causes, steps=EXCLUDED.steps, observations=EXCLUDED.observations, tools=EXCLUDED.tools, escalate=EXCLUDED.escalate, tags=EXCLUDED.tags, source_file=EXCLUDED.source_file, is_active=true;`);
  }

  // Roleplays
  for (const rp of data.roleplays || []) {
    lines.push(`INSERT INTO public.wiki_roleplays (source_id, title, area, persona, context, objective, customer_opening, success_criteria) VALUES (${sqlStr(rp.id)}, ${sqlStr(rp.title)}, ${sqlStr(rp.area)}, ${sqlStr(rp.persona)}, ${sqlStr(rp.context)}, ${sqlStr(rp.objective)}, ${sqlStr(rp.customerOpening)}, ${sqlArray(rp.successCriteria)}) ON CONFLICT (source_id) DO UPDATE SET title=EXCLUDED.title, area=EXCLUDED.area, persona=EXCLUDED.persona, context=EXCLUDED.context, objective=EXCLUDED.objective, customer_opening=EXCLUDED.customer_opening, success_criteria=EXCLUDED.success_criteria;`);
  }

  // Quiz (chave posicional, resolve article_id por subquery)
  (data.quiz || []).forEach((q, i) => {
    const sourceKey = `${file}:quiz:${i}`;
    const articleIdExpr = q.articleId
      ? `(SELECT id FROM public.wiki_articles WHERE source_id = ${sqlStr(q.articleId)})`
      : 'NULL';
    lines.push(`INSERT INTO public.wiki_quiz_questions (source_key, area, question, options, correct_index, explanation, article_id, article_source_id) VALUES (${sqlStr(sourceKey)}, ${sqlStr(q.area)}, ${sqlStr(q.q)}, ${sqlArray(q.options)}, ${q.answer}, ${sqlStrOrNull(q.explain)}, ${articleIdExpr}, ${sqlStrOrNull(q.articleId)}) ON CONFLICT (source_key) DO UPDATE SET area=EXCLUDED.area, question=EXCLUDED.question, options=EXCLUDED.options, correct_index=EXCLUDED.correct_index, explanation=EXCLUDED.explanation, article_id=EXCLUDED.article_id, article_source_id=EXCLUDED.article_source_id;`);
  });

  // Módulos + membresia ordenada
  (data.modules || []).forEach((m, i) => {
    const sourceKey = `${file}:module:${i}`;
    lines.push(`INSERT INTO public.wiki_modules (source_key, track, title, summary, order_index) VALUES (${sqlStr(sourceKey)}, ${sqlStr(m.track)}, ${sqlStr(m.title)}, ${sqlStrOrNull(m.summary)}, ${i}) ON CONFLICT (source_key) DO UPDATE SET track=EXCLUDED.track, title=EXCLUDED.title, summary=EXCLUDED.summary, order_index=EXCLUDED.order_index;`);
    lines.push(`DELETE FROM public.wiki_module_articles WHERE module_id = (SELECT id FROM public.wiki_modules WHERE source_key = ${sqlStr(sourceKey)});`);
    const articleIds = m.articleIds || [];
    if (articleIds.length > 0) {
      const values = articleIds.map((aid, idx) => `(${sqlStr(aid)}, ${idx})`).join(', ');
      lines.push(`INSERT INTO public.wiki_module_articles (module_id, article_id, order_index) SELECT (SELECT id FROM public.wiki_modules WHERE source_key = ${sqlStr(sourceKey)}), wa.id, v.ord FROM (VALUES ${values}) AS v(source_id, ord) JOIN public.wiki_articles wa ON wa.source_id = v.source_id;`);
    }
  });

  fs.writeFileSync(path.join(OUT_DIR, `wiki-load-${file}.sql`), lines.join('\n'));
  console.log(`${file}: ${data.articles?.length||0} articles, ${data.quiz?.length||0} quiz, ${data.roleplays?.length||0} roleplays, ${data.modules?.length||0} modules -> ${lines.length} statements`);
}
