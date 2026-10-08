-- Hoje o anti-ban (daily_limit/sent_today/business_hours/etc.) já existe,
-- mas é por CAMPANHA — duas campanhas ativas ao mesmo tempo podem somar
-- mais envios de WhatsApp do que o número aguenta sem risco de bloqueio.
-- Isso adiciona um teto GLOBAL de envios de WhatsApp por dia, por conta
-- (user_id), que vale pra soma de TODAS as campanhas juntas.
ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS whatsapp_global_daily_limit integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS whatsapp_global_sent_today integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS whatsapp_global_sent_date date;
