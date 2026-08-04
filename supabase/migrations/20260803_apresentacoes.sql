-- Sistema de Apresentações Comerciais - Prema Car
-- Espelha o sistema de Propostas (supabase/migrations/20260629_propostas.sql +
-- 20260731124257_....sql), mas sem preço/diagnóstico/aceite: é um documento
-- institucional (o deck "Parceiros Comerciais"), rastreado via link público.

CREATE TABLE IF NOT EXISTS apresentacoes_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  ordem INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS apresentacoes_comerciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  lead_id UUID NOT NULL REFERENCES leads_comerciais(id) ON DELETE CASCADE,
  template_id UUID REFERENCES apresentacoes_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','visualizada','expirada')),
  titulo_personalizado TEXT,
  assinatura_vendedor JSONB,
  validade_dias INTEGER NOT NULL DEFAULT 30,
  validade_ate DATE,
  slug TEXT UNIQUE NOT NULL,
  notas_vendedor TEXT,
  enviada_at TIMESTAMPTZ,
  visualizada_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS apresentacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  apresentacao_id UUID NOT NULL REFERENCES apresentacoes_comerciais(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  descricao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_apresentacoes_lead ON apresentacoes_comerciais(lead_id);
CREATE INDEX IF NOT EXISTS idx_apresentacoes_vendedor ON apresentacoes_comerciais(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_apresentacoes_status ON apresentacoes_comerciais(status);
CREATE INDEX IF NOT EXISTS idx_apresentacoes_slug ON apresentacoes_comerciais(slug);
CREATE INDEX IF NOT EXISTS idx_apresentacoes_historico ON apresentacoes_historico(apresentacao_id);

DROP TRIGGER IF EXISTS update_apresentacoes_updated_at ON apresentacoes_comerciais;
CREATE TRIGGER update_apresentacoes_updated_at
  BEFORE UPDATE ON apresentacoes_comerciais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: mesmo padrão hardened de propostas (só membros de equipe ativos,
-- via is_active_team_member já existente — não recriar a função aqui)
ALTER TABLE apresentacoes_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE apresentacoes_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE apresentacoes_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team members can read apresentacoes_templates" ON apresentacoes_templates;
DROP POLICY IF EXISTS "Admins can manage apresentacoes_templates" ON apresentacoes_templates;
DROP POLICY IF EXISTS "Team members can manage apresentacoes" ON apresentacoes_comerciais;
DROP POLICY IF EXISTS "Team members can access apresentacoes_historico" ON apresentacoes_historico;

CREATE POLICY "Team members can read apresentacoes_templates" ON apresentacoes_templates FOR SELECT TO authenticated
  USING (public.is_active_team_member(auth.uid()));
CREATE POLICY "Admins can manage apresentacoes_templates" ON apresentacoes_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members can manage apresentacoes" ON apresentacoes_comerciais FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

CREATE POLICY "Team members can access apresentacoes_historico" ON apresentacoes_historico FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

-- Nenhum acesso anônimo direto às tabelas — só via RPC abaixo (mesmo padrão de propostas)
REVOKE SELECT ON apresentacoes_comerciais FROM anon;
REVOKE SELECT ON apresentacoes_templates FROM anon;

-- RPC pública: retorna só o necessário para renderizar o deck (sem notas internas,
-- sem dados financeiros — apresentações não têm preço/diagnóstico)
CREATE OR REPLACE FUNCTION public.get_apresentacao_publica(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(x) FROM (
    SELECT a.id, a.status, a.titulo_personalizado, a.assinatura_vendedor,
           a.slug, a.created_at, a.validade_ate, a.template_id, a.lead_id,
           (SELECT to_jsonb(l2) FROM (
              SELECT l.empresa, l.responsavel
              FROM public.leads_comerciais l WHERE l.id = a.lead_id
           ) l2) AS lead,
           (SELECT to_jsonb(t2) FROM (
              SELECT t.tipo, t.nome
              FROM public.apresentacoes_templates t WHERE t.id = a.template_id
           ) t2) AS template
    FROM public.apresentacoes_comerciais a
    WHERE a.slug = p_slug AND a.status <> 'rascunho'
  ) x
$$;

-- RPC pública: só permite a transição enviada → visualizada (sem aceite/recusa)
CREATE OR REPLACE FUNCTION public.atualizar_status_apresentacao_publica(p_slug text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.apresentacoes_comerciais
  SET status = 'visualizada',
      visualizada_at = now(),
      updated_at = now()
  WHERE slug = p_slug
    AND status = 'enviada';

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_apresentacao_publica(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_status_apresentacao_publica(text) TO anon, authenticated;

INSERT INTO apresentacoes_templates (tipo, nome, descricao, ativo, ordem) VALUES
(
  'parceiros_comerciais', 'Parceiros Comerciais',
  'Deck institucional de 8 slides: o que a Prema faz, o problema que resolve, diferenciais, prova de resultado, perfil de público-alvo e como indicar.',
  TRUE, 0
)
ON CONFLICT (tipo) DO NOTHING;
