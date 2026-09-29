-- Integra a Campanhas (recurring_campaigns) as capacidades que hoje só
-- existem em Disparos (campaigns/campaign_leads/campaign_variations/
-- campaign_send_rules): paginação anti-ban, teste A/B com vencedor
-- automático. campaign_blacklist já é global por usuário — reaproveitada
-- diretamente pelo processador, sem tabela nova.
--
-- anti_ban_enabled aqui nasce FALSE (diferente de `campaigns`, que nasce
-- TRUE) — campanhas já existentes (cadências de poucos contatos por dia)
-- continuam disparando na hora, sem paginação, a menos que o usuário
-- ligue explicitamente na etapa nova do wizard.

ALTER TABLE public.recurring_campaigns
  ADD COLUMN IF NOT EXISTS daily_limit INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS interval_type TEXT NOT NULL DEFAULT 'random',
  ADD COLUMN IF NOT EXISTS interval_min INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS interval_max INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS business_hours_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS business_hours_start TIME DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS business_hours_end TIME DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS business_days INTEGER[] DEFAULT '{1,2,3,4,5}'::integer[],
  ADD COLUMN IF NOT EXISTS anti_ban_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_after_count INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS pause_duration_minutes INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS scheduled_start TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS sent_today INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS paused_until TIMESTAMP WITH TIME ZONE;

-- ─────────────────────────────────────────────
-- recurring_campaign_variations (espelha campaign_variations)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_campaign_variations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      UUID NOT NULL REFERENCES public.recurring_campaigns(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_recurring_campaign_variations_campaign_id
  ON public.recurring_campaign_variations(campaign_id);

-- ─────────────────────────────────────────────
-- recurring_campaign_send_rules (espelha campaign_send_rules)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.recurring_campaign_send_rules (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id              UUID NOT NULL REFERENCES public.recurring_campaigns(id) ON DELETE CASCADE UNIQUE,
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

CREATE INDEX IF NOT EXISTS idx_recurring_campaign_send_rules_campaign_id
  ON public.recurring_campaign_send_rules(campaign_id);

ALTER TABLE public.recurring_campaign_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_campaign_send_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_campaign_variations_user_access" ON public.recurring_campaign_variations
  USING (campaign_id IN (SELECT id FROM public.recurring_campaigns WHERE user_id = auth.uid()))
  WITH CHECK (campaign_id IN (SELECT id FROM public.recurring_campaigns WHERE user_id = auth.uid()));

CREATE POLICY "recurring_campaign_send_rules_user_access" ON public.recurring_campaign_send_rules
  USING (campaign_id IN (SELECT id FROM public.recurring_campaigns WHERE user_id = auth.uid()))
  WITH CHECK (campaign_id IN (SELECT id FROM public.recurring_campaigns WHERE user_id = auth.uid()));

-- Admins/membros de equipe também gerenciam (mesmo padrão de recurring_campaigns)
CREATE POLICY "Admins can manage all recurring_campaign_variations" ON public.recurring_campaign_variations
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all recurring_campaign_send_rules" ON public.recurring_campaign_send_rules
  FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Reset diário de sent_today — mesmo padrão de reset_campaign_daily_counts()
CREATE OR REPLACE FUNCTION public.reset_recurring_campaign_daily_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.recurring_campaigns
  SET sent_today = 0, updated_at = now()
  WHERE status IN ('active', 'paused');
END;
$$;

-- Nenhuma das duas funções de reset diário (Disparos e Campanhas) tinha
-- cron chamando — sent_today nunca zerava. Agenda 1x por dia (03:00 UTC
-- ~ meia-noite em Brasília).
SELECT cron.schedule(
  'reset-campaign-daily-counts',
  '0 3 * * *',
  $$SELECT public.reset_campaign_daily_counts(); SELECT public.reset_recurring_campaign_daily_counts();$$
);

-- Data API grants (Supabase remove o auto-grant em tabelas novas a partir de 30/10/2026)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_campaign_variations TO authenticated;
GRANT ALL ON public.recurring_campaign_variations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_campaign_send_rules TO authenticated;
GRANT ALL ON public.recurring_campaign_send_rules TO service_role;
