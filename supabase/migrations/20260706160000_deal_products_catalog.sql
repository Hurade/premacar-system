-- ============================================================
-- FASE 2.2: Catálogo de produtos vinculado ao pipeline/deal
--
-- Reaproveita `planos_propostas` (já existe, hoje só usado pelo módulo de
-- Propostas Comerciais) como catálogo único de produtos do CRM operacional.
-- Não altera o CHECK de `tipo` existente (usado pelo diagnóstico de Propostas)
-- para não quebrar aquele fluxo — adiciona colunas novas e opcionais.
--
-- Decisão confirmada com o usuário: deals.value continua manual/livre; o
-- total dos produtos vinculados é calculado no frontend como um campo
-- separado, sem trigger de recálculo automático.
-- ============================================================

ALTER TABLE public.planos_propostas
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'geral',
  ADD COLUMN IF NOT EXISTS visivel_pipeline BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_planos_propostas_ativo ON public.planos_propostas(ativo);
CREATE INDEX IF NOT EXISTS idx_planos_propostas_visivel_pipeline ON public.planos_propostas(visivel_pipeline);

CREATE TABLE IF NOT EXISTS public.deal_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES public.planos_propostas(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  valor_aplicado NUMERIC(10,2) NOT NULL DEFAULT 0, -- snapshot do preço no momento (permite desconto manual sem alterar o catálogo)
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deal_id, plano_id)
);

CREATE INDEX IF NOT EXISTS idx_deal_products_deal_id ON public.deal_products(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_products_plano_id ON public.deal_products(plano_id);

CREATE TRIGGER update_deal_products_updated_at
  BEFORE UPDATE ON public.deal_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.deal_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage deal_products"
  ON public.deal_products FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
