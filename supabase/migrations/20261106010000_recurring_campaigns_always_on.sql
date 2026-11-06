ALTER TABLE public.recurring_campaigns
  ADD COLUMN IF NOT EXISTS always_on BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.recurring_campaigns.always_on IS
  'Campanhas de nutrição contínua (alimentadas aos poucos via automação por tag) nunca devem virar completed só porque a fila de in_progress esvaziou momentaneamente. Ver recurring-campaign-processor.';
