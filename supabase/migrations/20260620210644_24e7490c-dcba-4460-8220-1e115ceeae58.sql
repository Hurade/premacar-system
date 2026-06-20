
-- ════════════════════════════════════════════════════════════════════
-- Aplica migrações pendentes: agent_configs, campaign_variations, campaign_send_rules
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────
-- 1. agent_configs
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🤖',
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('default', 'origin', 'campaign', 'event')),
  trigger_origin TEXT CHECK (trigger_origin IN ('disparo', 'inbound', 'retorno')),
  trigger_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  trigger_event TEXT,
  system_prompt TEXT NOT NULL,
  model_mode TEXT NOT NULL DEFAULT 'flash' CHECK (model_mode IN ('flash', 'pro', 'pro3', 'adaptive')),
  max_messages_per_hour INTEGER NOT NULL DEFAULT 10,
  response_delay_seconds INTEGER NOT NULL DEFAULT 30,
  message_breaking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ai_activation_delay_minutes INTEGER NOT NULL DEFAULT 5,
  handoff_keywords TEXT[] DEFAULT '{}',
  handoff_message TEXT DEFAULT 'Um momento, vou te conectar com nossa equipe! 😊',
  priority INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_configs TO authenticated;
GRANT ALL ON public.agent_configs TO service_role;

ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_configs_trigger_type ON public.agent_configs (trigger_type, is_active);
CREATE INDEX IF NOT EXISTS idx_agent_configs_origin ON public.agent_configs (trigger_origin) WHERE trigger_origin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_configs_campaign ON public.agent_configs (trigger_campaign_id) WHERE trigger_campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_configs_priority ON public.agent_configs (priority DESC, is_active);

DROP POLICY IF EXISTS "Authenticated users can read agent_configs" ON public.agent_configs;
DROP POLICY IF EXISTS "Authenticated users can manage agent_configs" ON public.agent_configs;

CREATE POLICY "Authenticated users can read agent_configs"
  ON public.agent_configs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage agent_configs"
  ON public.agent_configs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_agent_configs_updated_at ON public.agent_configs;
CREATE TRIGGER trg_agent_configs_updated_at
  BEFORE UPDATE ON public.agent_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: 3 agentes iniciais (apenas se tabela vazia)
INSERT INTO public.agent_configs (name, description, icon, trigger_type, priority, model_mode, system_prompt)
SELECT 'Cris SDR — Padrão',
       'Agente padrão da Cris para todas as conversas sem agente específico',
       '🤖', 'default', 0, 'flash',
       'Você é a Cris, SDR da PremaCar. Qualifique donos de oficinas e agende demos. 2-4 linhas por mensagem. Uma pergunta por vez.'
WHERE NOT EXISTS (SELECT 1 FROM public.agent_configs);

INSERT INTO public.agent_configs (name, description, icon, trigger_type, trigger_origin, priority, model_mode, system_prompt, handoff_keywords, handoff_message)
SELECT 'Cris Reativação — Disparo',
       'Ativado quando o lead responde a um disparo de campanha.',
       '📣', 'origin', 'disparo', 50, 'flash',
       'Você é a Cris. Este lead respondeu a um disparo. Entenda o estabelecimento, descubra a dor e agende demo. 2-3 linhas, uma pergunta por vez.',
       ARRAY['preço','quanto custa','valor','desconto','falar com alguém','responsável','gerente'],
       'Deixa eu te conectar com nossa equipe! 😊'
WHERE NOT EXISTS (SELECT 1 FROM public.agent_configs WHERE trigger_type = 'origin' AND trigger_origin = 'disparo');

INSERT INTO public.agent_configs (name, description, icon, trigger_type, trigger_origin, priority, model_mode, system_prompt, handoff_keywords)
SELECT 'Cris Inbound — Contato Espontâneo',
       'Ativado quando o lead entra em contato por conta própria.',
       '📥', 'origin', 'inbound', 50, 'pro',
       'Você é a Cris. Este lead entrou em contato espontaneamente. Atenda com agilidade, qualifique e agende demo. 2-4 linhas.',
       ARRAY['preço','quanto custa','valor','contrato','falar com alguém']
WHERE NOT EXISTS (SELECT 1 FROM public.agent_configs WHERE trigger_type = 'origin' AND trigger_origin = 'inbound');

-- ─────────────────────────────────────────────────────────────────
-- 2. campaign_variations
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_variations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  label            TEXT NOT NULL,
  name             TEXT NOT NULL DEFAULT '',
  weight           INTEGER NOT NULL DEFAULT 50 CHECK (weight > 0 AND weight <= 100),
  meta_template_id UUID REFERENCES public.meta_templates(id) ON DELETE SET NULL,
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_variations TO authenticated;
GRANT ALL ON public.campaign_variations TO service_role;

ALTER TABLE public.campaign_variations ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_campaign_variations_campaign_id ON public.campaign_variations(campaign_id);

DROP POLICY IF EXISTS "campaign_variations_user_access" ON public.campaign_variations;
CREATE POLICY "campaign_variations_user_access" ON public.campaign_variations
  FOR ALL TO authenticated
  USING (campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid()))
  WITH CHECK (campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_campaign_variations_updated_at ON public.campaign_variations;
CREATE TRIGGER trg_campaign_variations_updated_at
  BEFORE UPDATE ON public.campaign_variations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────
-- 3. campaign_send_rules
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaign_send_rules (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id              UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE UNIQUE,
  max_per_hour             INTEGER NOT NULL DEFAULT 200,
  max_per_day              INTEGER NOT NULL DEFAULT 1000,
  min_interval_seconds     INTEGER NOT NULL DEFAULT 3,
  max_interval_seconds     INTEGER NOT NULL DEFAULT 10,
  auto_pause_on_errors     BOOLEAN NOT NULL DEFAULT TRUE,
  error_rate_threshold     NUMERIC(5,2) NOT NULL DEFAULT 15.0,
  error_window_sends       INTEGER NOT NULL DEFAULT 30,
  pause_duration_minutes   INTEGER NOT NULL DEFAULT 60,
  ab_auto_winner           BOOLEAN NOT NULL DEFAULT FALSE,
  ab_winner_min_sends      INTEGER NOT NULL DEFAULT 100,
  ab_winner_metric         TEXT NOT NULL DEFAULT 'reply_rate'
                             CHECK (ab_winner_metric IN ('reply_rate','read_rate','delivery_rate')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_send_rules TO authenticated;
GRANT ALL ON public.campaign_send_rules TO service_role;

ALTER TABLE public.campaign_send_rules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_campaign_send_rules_campaign_id ON public.campaign_send_rules(campaign_id);

DROP POLICY IF EXISTS "campaign_send_rules_user_access" ON public.campaign_send_rules;
CREATE POLICY "campaign_send_rules_user_access" ON public.campaign_send_rules
  FOR ALL TO authenticated
  USING (campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid()))
  WITH CHECK (campaign_id IN (SELECT id FROM public.campaigns WHERE user_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_campaign_send_rules_updated_at ON public.campaign_send_rules;
CREATE TRIGGER trg_campaign_send_rules_updated_at
  BEFORE UPDATE ON public.campaign_send_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────
-- 4. Função auxiliar: incrementar métrica de variação
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_variation_counter(
  p_campaign_id UUID,
  p_lead_id     UUID,
  p_counter     TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_variation_index INTEGER;
  v_variation_id    UUID;
BEGIN
  SELECT variation_used INTO v_variation_index
  FROM public.campaign_leads
  WHERE id = p_lead_id;

  IF v_variation_index IS NULL THEN
    RETURN;
  END IF;

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

  IF p_counter NOT IN ('total_sent','total_delivered','total_read','total_replied','total_errors') THEN
    RAISE EXCEPTION 'Invalid counter: %', p_counter;
  END IF;

  EXECUTE format(
    'UPDATE public.campaign_variations SET %I = %I + 1, updated_at = NOW() WHERE id = $1',
    p_counter, p_counter
  ) USING v_variation_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_variation_counter(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_variation_counter(UUID, UUID, TEXT) TO authenticated, service_role;
