-- Wiki interna — substitui a ferramenta standalone "Central Prema"
-- (central-prema.vercel.app, login Google + Firebase próprio). Reaproveita
-- o login/papéis já existentes do CRM (Supabase Auth + team_members) — por
-- isso não existe sistema de aprovação de acesso aqui, diferente da
-- ferramenta original: todo usuário logado no CRM já pode usar a Wiki.
--
-- Conteúdo ingerido vem de 4 JSON fora deste repo (c:\VScode\Prema\Central\
-- _fontes\{comercial,institucional,suporte,cs}.json) via supabase/functions/
-- wiki-ingest — ver esse arquivo pro formato exato.

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- unaccent() é STABLE, não IMMUTABLE — não roda direto dentro de uma coluna
-- GENERATED ALWAYS AS STORED. Wrapper IMMUTABLE é o workaround documentado
-- pelo próprio Postgres pra esse caso.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT extensions.unaccent('extensions.unaccent', $1) $$;

-- array_to_string() é STABLE neste Postgres (não IMMUTABLE), mesmo problema
-- do unaccent — mesmo workaround.
CREATE OR REPLACE FUNCTION public.f_array_to_string(text[], text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS
$$ SELECT array_to_string($1, $2) $$;

-- Mirror de is_admin_user() pra restringir o Painel do Gestor também no
-- nível de banco (não só esconder a aba no front) — "manager" OU "admin".
CREATE OR REPLACE FUNCTION public.is_manager_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS
$$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = _user_id AND tm.role IN ('admin','manager') AND tm.status = 'active'
    )
  )
$$;

-- ------------------------------------------------------------
-- wiki_articles
-- ------------------------------------------------------------
CREATE TABLE public.wiki_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL UNIQUE,             -- "sup-001" etc — chave idempotente do JSON
  title TEXT NOT NULL,
  system TEXT NOT NULL CHECK (system IN (
    'Prema Pós-vendas','Prema Atendimento','WhaTicket',
    'Automax Oficina','Automax Frotas','Maxsig','Geral'
  )),
  area TEXT NOT NULL CHECK (area IN (
    'Suporte','CS','Onboarding','Comercial','Institucional','RH','Gestão'
  )),
  category TEXT,
  description TEXT NOT NULL,
  causes TEXT[] NOT NULL DEFAULT '{}',
  steps TEXT[] NOT NULL DEFAULT '{}',
  observations TEXT[] NOT NULL DEFAULT '{}',
  tools TEXT[] NOT NULL DEFAULT '{}',
  escalate TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  source_file TEXT,
  embedding extensions.vector(1024),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', public.f_unaccent(
      coalesce(title,'') || ' ' || coalesce(description,'') || ' ' ||
      coalesce(public.f_array_to_string(steps,' '),'') || ' ' ||
      coalesce(public.f_array_to_string(observations,' '),'') || ' ' ||
      coalesce(public.f_array_to_string(tags,' '),'') || ' ' || coalesce(category,'')
    ))
  ) STORED
);
CREATE INDEX idx_wiki_articles_search_vector ON public.wiki_articles USING GIN (search_vector);
CREATE INDEX idx_wiki_articles_area ON public.wiki_articles (area);
CREATE INDEX idx_wiki_articles_system ON public.wiki_articles (system);
CREATE INDEX idx_wiki_articles_embedding_hnsw ON public.wiki_articles USING hnsw (embedding extensions.vector_cosine_ops);
CREATE TRIGGER update_wiki_articles_updated_at BEFORE UPDATE ON public.wiki_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- wiki_quiz_questions (quiz não tem id próprio no JSON — chave posicional)
-- ------------------------------------------------------------
CREATE TABLE public.wiki_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,            -- "<arquivo>:quiz:<indice>"
  area TEXT NOT NULL,
  question TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_index SMALLINT NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  explanation TEXT,
  article_id UUID REFERENCES public.wiki_articles(id) ON DELETE SET NULL,
  article_source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wiki_quiz_article_id ON public.wiki_quiz_questions (article_id);

-- ------------------------------------------------------------
-- wiki_roleplays
-- ------------------------------------------------------------
CREATE TABLE public.wiki_roleplays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  area TEXT NOT NULL,
  persona TEXT NOT NULL,
  context TEXT NOT NULL,
  objective TEXT NOT NULL,
  customer_opening TEXT NOT NULL,
  success_criteria TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- wiki_modules + wiki_module_articles (membresia ordenada)
-- ------------------------------------------------------------
CREATE TABLE public.wiki_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_key TEXT NOT NULL UNIQUE,             -- "<arquivo>:module:<indice>"
  track TEXT NOT NULL CHECK (track IN (
    'Integração (todos os colaboradores)','Suporte','CS','Comercial'
  )),
  title TEXT NOT NULL,
  summary TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wiki_modules_track ON public.wiki_modules (track, order_index);
CREATE TRIGGER update_wiki_modules_updated_at BEFORE UPDATE ON public.wiki_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wiki_module_articles (
  module_id UUID NOT NULL REFERENCES public.wiki_modules(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES public.wiki_articles(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL,
  PRIMARY KEY (module_id, article_id)
);
CREATE UNIQUE INDEX idx_wiki_module_articles_order ON public.wiki_module_articles (module_id, order_index);

-- ------------------------------------------------------------
-- wiki_progress (por usuário, por módulo — "marcar como estudado" + quiz)
-- ------------------------------------------------------------
CREATE TABLE public.wiki_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.wiki_modules(id) ON DELETE CASCADE,
  studied_at TIMESTAMPTZ,
  quiz_score SMALLINT,
  quiz_total SMALLINT,
  quiz_attempts SMALLINT NOT NULL DEFAULT 0,
  quiz_passed BOOLEAN NOT NULL DEFAULT false,
  last_quiz_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_id)
);
CREATE TRIGGER update_wiki_progress_updated_at BEFORE UPDATE ON public.wiki_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- wiki_track_quiz_results (quiz final por trilha, histórico)
-- ------------------------------------------------------------
CREATE TABLE public.wiki_track_quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track TEXT NOT NULL CHECK (track IN (
    'Integração (todos os colaboradores)','Suporte','CS','Comercial'
  )),
  score SMALLINT NOT NULL,
  total SMALLINT NOT NULL,
  passed BOOLEAN NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wiki_track_quiz_user_track ON public.wiki_track_quiz_results (user_id, track, completed_at DESC);

-- ------------------------------------------------------------
-- wiki_ai_queries (log de perguntas aos agentes Max/Clara/Tutor + lacunas)
-- ------------------------------------------------------------
CREATE TABLE public.wiki_ai_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent TEXT NOT NULL CHECK (agent IN ('max','clara','tutor')),
  area_filter TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  matched_article_ids UUID[] NOT NULL DEFAULT '{}',
  best_similarity REAL,
  is_gap BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wiki_ai_queries_gap ON public.wiki_ai_queries (is_gap, created_at DESC);
CREATE INDEX idx_wiki_ai_queries_user ON public.wiki_ai_queries (user_id);

-- ------------------------------------------------------------
-- wiki_feedback (👎 numa resposta de IA)
-- ------------------------------------------------------------
CREATE TABLE public.wiki_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_query_id UUID NOT NULL REFERENCES public.wiki_ai_queries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wiki_feedback_query ON public.wiki_feedback (ai_query_id);

-- ------------------------------------------------------------
-- wiki_simulator_sessions
-- ------------------------------------------------------------
CREATE TABLE public.wiki_simulator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roleplay_id UUID NOT NULL REFERENCES public.wiki_roleplays(id) ON DELETE CASCADE,
  transcript JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','evaluated','abandoned')),
  score SMALLINT,
  evaluation TEXT,
  criteria_met JSONB,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX idx_wiki_simulator_sessions_user ON public.wiki_simulator_sessions (user_id, started_at DESC);

-- ------------------------------------------------------------
-- RPC: match_wiki_articles — RAG isolado pros agentes Max/Clara/Tutor.
-- NÃO reaproveita knowledge_chunks/match_documents de propósito: aquele
-- pipeline serve o nina-orchestrator pra conversas reais de cliente, e uma
-- linha com queue_id nulo lá entra no contexto de QUALQUER fila — colocar
-- conteúdo de treinamento interno ali vazaria pra conversas com clientes.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_wiki_articles(
  query_embedding extensions.vector(1024),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 6,
  p_area TEXT DEFAULT NULL
) RETURNS TABLE (
  id UUID, source_id TEXT, title TEXT, area TEXT, system TEXT,
  description TEXT, steps TEXT[], similarity FLOAT
) LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT wa.id, wa.source_id, wa.title, wa.area, wa.system, wa.description, wa.steps,
         1 - (wa.embedding <=> query_embedding) AS similarity
  FROM public.wiki_articles wa
  WHERE wa.is_active AND wa.embedding IS NOT NULL
    AND (p_area IS NULL OR wa.area = p_area)
    AND 1 - (wa.embedding <=> query_embedding) > match_threshold
  ORDER BY wa.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ------------------------------------------------------------
-- RPC: search_wiki_articles — busca textual (tela "Base de Conhecimento"),
-- sem acento (BM25-ish via ts_rank em português + unaccent).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_wiki_articles(
  p_query TEXT DEFAULT NULL, p_area TEXT DEFAULT NULL, p_system TEXT DEFAULT NULL, p_limit INT DEFAULT 30
) RETURNS TABLE (
  id UUID, source_id TEXT, title TEXT, area TEXT, system TEXT, category TEXT,
  description TEXT, tags TEXT[], rank FLOAT
) LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT wa.id, wa.source_id, wa.title, wa.area, wa.system, wa.category, wa.description, wa.tags,
         ts_rank(wa.search_vector, websearch_to_tsquery('portuguese', public.f_unaccent(coalesce(p_query,'')))) AS rank
  FROM public.wiki_articles wa
  WHERE wa.is_active
    AND (p_area IS NULL OR wa.area = p_area)
    AND (p_system IS NULL OR wa.system = p_system)
    AND (p_query IS NULL OR btrim(p_query) = '' OR wa.search_vector @@ websearch_to_tsquery('portuguese', public.f_unaccent(p_query)))
  ORDER BY (p_query IS NOT NULL AND btrim(p_query) <> '') DESC, rank DESC, wa.title ASC
  LIMIT p_limit;
$$;

-- ------------------------------------------------------------
-- Painel do gestor: progresso do time por trilha. security_invoker=true é
-- essencial — sem isso a view roda com privilégio de quem aplicou a
-- migration, ignorando a RLS das tabelas de baixo pra qualquer usuário.
-- ------------------------------------------------------------
CREATE VIEW public.wiki_team_progress_summary WITH (security_invoker = true) AS
SELECT tm.id AS team_member_id, tm.name, tm.email, tm.role, wm.track,
  count(wm.id) AS total_modules,
  count(wp.studied_at) FILTER (WHERE wp.studied_at IS NOT NULL) AS studied_modules,
  round(100.0 * count(wp.studied_at) FILTER (WHERE wp.studied_at IS NOT NULL) / NULLIF(count(wm.id), 0), 1) AS pct_studied,
  avg(wp.quiz_score::float / NULLIF(wp.quiz_total, 0)) FILTER (WHERE wp.quiz_total IS NOT NULL) AS avg_quiz_ratio
FROM public.team_members tm
CROSS JOIN public.wiki_modules wm
LEFT JOIN public.wiki_progress wp ON wp.module_id = wm.id AND wp.user_id = tm.user_id
WHERE tm.status = 'active'
GROUP BY tm.id, tm.name, tm.email, tm.role, wm.track;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
ALTER TABLE public.wiki_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_roleplays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_module_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_track_quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_ai_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_simulator_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read wiki_articles" ON public.wiki_articles
  FOR SELECT TO authenticated USING (public.is_active_team_member(auth.uid()));
CREATE POLICY "Team members can read wiki_quiz_questions" ON public.wiki_quiz_questions
  FOR SELECT TO authenticated USING (public.is_active_team_member(auth.uid()));
CREATE POLICY "Team members can read wiki_roleplays" ON public.wiki_roleplays
  FOR SELECT TO authenticated USING (public.is_active_team_member(auth.uid()));
CREATE POLICY "Team members can read wiki_modules" ON public.wiki_modules
  FOR SELECT TO authenticated USING (public.is_active_team_member(auth.uid()));
CREATE POLICY "Team members can read wiki_module_articles" ON public.wiki_module_articles
  FOR SELECT TO authenticated USING (public.is_active_team_member(auth.uid()));

-- Tabelas "pessoais": dono vê/edita a própria linha; gestor/admin vê tudo
-- (restrição de verdade no banco, não só esconder aba no front).
CREATE POLICY "Own or manager read wiki_progress" ON public.wiki_progress
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_manager_user(auth.uid()));
CREATE POLICY "Users insert own wiki_progress" ON public.wiki_progress
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_team_member(auth.uid()));
CREATE POLICY "Users update own wiki_progress" ON public.wiki_progress
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Own or manager read wiki_track_quiz_results" ON public.wiki_track_quiz_results
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_manager_user(auth.uid()));
CREATE POLICY "Users insert own wiki_track_quiz_results" ON public.wiki_track_quiz_results
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_team_member(auth.uid()));

CREATE POLICY "Own or manager read wiki_ai_queries" ON public.wiki_ai_queries
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_manager_user(auth.uid()));
CREATE POLICY "Users insert own wiki_ai_queries" ON public.wiki_ai_queries
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_team_member(auth.uid()));

CREATE POLICY "Own or manager read wiki_feedback" ON public.wiki_feedback
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_manager_user(auth.uid()));
CREATE POLICY "Users insert own wiki_feedback" ON public.wiki_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_team_member(auth.uid()));

CREATE POLICY "Own or manager read wiki_simulator_sessions" ON public.wiki_simulator_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_manager_user(auth.uid()));
CREATE POLICY "Users insert own wiki_simulator_sessions" ON public.wiki_simulator_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.is_active_team_member(auth.uid()));
CREATE POLICY "Users update own wiki_simulator_sessions" ON public.wiki_simulator_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.wiki_articles, public.wiki_quiz_questions, public.wiki_roleplays,
  public.wiki_modules, public.wiki_module_articles TO authenticated;
GRANT ALL ON public.wiki_articles, public.wiki_quiz_questions, public.wiki_roleplays,
  public.wiki_modules, public.wiki_module_articles TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.wiki_progress, public.wiki_track_quiz_results,
  public.wiki_ai_queries, public.wiki_feedback, public.wiki_simulator_sessions TO authenticated;
GRANT ALL ON public.wiki_progress, public.wiki_track_quiz_results,
  public.wiki_ai_queries, public.wiki_feedback, public.wiki_simulator_sessions TO service_role;
GRANT SELECT ON public.wiki_team_progress_summary TO authenticated;
