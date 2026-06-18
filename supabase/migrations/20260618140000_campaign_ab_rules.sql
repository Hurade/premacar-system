-- ═══════════════════════════════════════════════════════════════════
-- A/B Test Variations + Send Rules para Campanhas (Disparos)
--
-- campaign_variations: variações de template A/B por campanha
-- campaign_send_rules: regras de envio, limites e proteção contra bloqueio
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. campaign_variations
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_variations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  label            TEXT NOT NULL, -- 'A', 'B', 'C', ...
  name             TEXT NOT NULL DEFAULT '',
  weight           INTEGER NOT NULL DEFAULT 50
                     CHECK (weight > 0 AND weight <= 100),
  meta_template_id UUID REFERENCES public.meta_templates(id) ON DELETE SET NULL,
  -- Métricas acumuladas (atualizadas pelo campaign-processor e webhooks)
  total_sent       INTEGER NOT NULL DEFAULT 0,
  total_delivered  INTEGER NOT NULL DEFAULT 0,
  total_read       INTEGER NOT NULL DEFAULT 0,
  total_replied    INTEGER NOT NULL DEFAULT 0,
  total_errors     INTEGER NOT NULL DEFAULT 0,
  is_winner        BOOLEAN NOT NULL DEFAULT FALSE,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (campaign_id, label)
);

CREATE INDEX IF NOT EXISTS idx_campaign_variations_campaign_id
  ON public.campaign_variations(campaign_id);

-- ─────────────────────────────────────────────
-- 2. campaign_send_rules
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_send_rules (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id              UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE UNIQUE,
  -- Limites de velocidade
  max_per_hour             INTEGER NOT NULL DEFAULT 200,
  max_per_day              INTEGER NOT NULL DEFAULT 1000,
  min_interval_seconds     INTEGER NOT NULL DEFAULT 3,
  max_interval_seconds     INTEGER NOT NULL DEFAULT 10,
  -- Proteção contra bloqueio Meta
  auto_pause_on_errors     BOOLEAN NOT NULL DEFAULT TRUE,
  error_rate_threshold     NUMERIC(5,2) NOT NULL DEFAULT 15.0,
  error_window_sends       INTEGER NOT NULL DEFAULT 30,
  pause_duration_minutes   INTEGER NOT NULL DEFAULT 60,
  -- Seleção automática de vencedor A/B
  ab_auto_winner           BOOLEAN NOT NULL DEFAULT FALSE,
  ab_winner_min_sends      INTEGER NOT NULL DEFAULT 100,
  ab_winner_metric         TEXT NOT NULL DEFAULT 'reply_rate'
                             CHECK (ab_winner_metric IN ('reply_rate','read_rate','delivery_rate')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_send_rules_campaign_id
  ON public.campaign_send_rules(campaign_id);

-- ─────────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────────
ALTER TABLE public.campaign_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_send_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_variations_user_access" ON public.campaign_variations
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "campaign_send_rules_user_access" ON public.campaign_send_rules
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- 4. Função auxiliar: incrementar métrica de variação
-- Chamada pelo whatsapp-webhook ao receber status de entrega/leitura/resposta
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_variation_counter(
  p_campaign_id   UUID,
  p_lead_id       UUID,
  p_counter       TEXT  -- 'total_delivered' | 'total_read' | 'total_replied' | 'total_errors'
)
RETURNS VOID AS $$
DECLARE
  v_variation_index INTEGER;
  v_variation_id    UUID;
BEGIN
  -- Buscar qual variação foi usada para este lead
  SELECT variation_used INTO v_variation_index
  FROM public.campaign_leads
  WHERE id = p_lead_id;

  IF v_variation_index IS NULL THEN
    RETURN;
  END IF;

  -- Buscar ID da variação pelo índice (ordem por label)
  SELECT id INTO v_variation_id
  FROM public.campaign_variations
  WHERE campaign_id = p_campaign_id
    AND is_active = TRUE
  ORDER BY label
  LIMIT 1
  OFFSET v_variation_index;

  IF v_variation_id IS NULL THEN
    RETURN;
  END IF;

  EXECUTE format(
    'UPDATE public.campaign_variations SET %I = %I + 1, updated_at = NOW() WHERE id = $1',
    p_counter, p_counter
  ) USING v_variation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
