-- Personalização de conteúdo para Apresentações + segundo template
-- (Oficina/Auto Center — venda direta, com preço, diferente do
-- template institucional "Parceiros Comerciais").

ALTER TABLE apresentacoes_comerciais
  ADD COLUMN IF NOT EXISTS publico_alvo TEXT CHECK (publico_alvo IN ('parceiro_comercial','oficina','autocenter')),
  ADD COLUMN IF NOT EXISTS atuacao_principal TEXT CHECK (atuacao_principal IN ('oleo','pneus','mecanica_geral','outro')),
  ADD COLUMN IF NOT EXISTS estrategia_inicial TEXT CHECK (estrategia_inicial IN ('mensurar','fidelizar','recuperar')),
  ADD COLUMN IF NOT EXISTS tem_erp BOOLEAN,
  ADD COLUMN IF NOT EXISTS erp_nome TEXT;

INSERT INTO apresentacoes_templates (tipo, nome, descricao, ativo, ordem) VALUES
(
  'oficina_direta', 'Oficina / Auto Center',
  'Deck de venda direta para o dono da oficina/auto center — com investimento (planos Mensurar/Fidelizar/Recuperar), personalizado por atuação (óleo, pneus, mecânica geral).',
  TRUE, 1
)
ON CONFLICT (tipo) DO NOTHING;

-- Atualiza a RPC pública para expor os novos campos de personalização
-- (necessários para renderizar o conteúdo correto no deck público)
CREATE OR REPLACE FUNCTION public.get_apresentacao_publica(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(x) FROM (
    SELECT a.id, a.status, a.titulo_personalizado, a.assinatura_vendedor,
           a.slug, a.created_at, a.validade_ate, a.template_id, a.lead_id,
           a.publico_alvo, a.atuacao_principal, a.estrategia_inicial, a.tem_erp, a.erp_nome,
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
