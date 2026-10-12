-- Custo Total sempre mostrava R$0 — nenhum lugar do sistema calculava
-- custo de envio. Valores por unidade (estimativas de mercado, editáveis
-- aqui se os valores reais negociados forem diferentes):
-- e-mail (SES) ~R$0,0006/envio, WhatsApp (Meta, conversa marketing BR)
-- ~R$0,08/mensagem, ligação (Twilio+ElevenLabs) ~R$0,35/minuto.
ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS cost_per_email numeric NOT NULL DEFAULT 0.0006,
  ADD COLUMN IF NOT EXISTS cost_per_whatsapp_message numeric NOT NULL DEFAULT 0.08,
  ADD COLUMN IF NOT EXISTS cost_per_call_minute numeric NOT NULL DEFAULT 0.35;

-- recurring_campaigns.actual_cost nunca era escrito por nenhuma função —
-- igual ao problema dos contadores de sucesso/falha, calcula ao vivo em
-- vez de depender de um campo acumulado que ninguém atualiza. E-mail e
-- WhatsApp vêm de system_logs (contagem de envios OK); ligação vem de
-- voice_calls.duration_seconds (tem campaign_id e duração reais).
-- CREATE OR REPLACE não troca o tipo de uma coluna existente (actual_cost
-- era numeric(10,2) herdado de rc.actual_cost, agora é numeric calculado) —
-- precisa derrubar a view e recriar.
DROP VIEW IF EXISTS public.recurring_campaigns_live;

CREATE VIEW public.recurring_campaigns_live AS
SELECT
  rc.id,
  rc.name,
  rc.description,
  rc.objective,
  rc.flow_config,
  rc.status,
  COALESCE(cc.total, 0) AS total_contacts,
  COALESCE(cc.in_progress, 0) AS in_progress_count,
  COALESCE(cc.success, 0) AS success_count,
  COALESCE(cc.failed, 0) AS failed_count,
  COALESCE(sl.send_ok, 0) AS send_success_count,
  COALESCE(sl.send_fail, 0) AS send_failed_count,
  rc.estimated_cost,
  COALESCE(sl.email_count, 0) * COALESCE(settings.cost_per_email, 0.0006)
    + COALESCE(sl.whatsapp_count, 0) * COALESCE(settings.cost_per_whatsapp_message, 0.08)
    + (COALESCE(vc.call_seconds, 0) / 60.0) * COALESCE(settings.cost_per_call_minute, 0.35)
    AS actual_cost,
  rc.created_by,
  rc.user_id,
  rc.created_at,
  rc.updated_at,
  rc.started_at,
  rc.ended_at,
  rc.connection_id,
  rc.daily_limit,
  rc.interval_type,
  rc.interval_min,
  rc.interval_max,
  rc.business_hours_enabled,
  rc.business_hours_start,
  rc.business_hours_end,
  rc.business_days,
  rc.anti_ban_enabled,
  rc.pause_after_count,
  rc.pause_duration_minutes,
  rc.scheduled_start,
  rc.sent_today,
  rc.last_sent_at,
  rc.paused_until
FROM public.recurring_campaigns rc
LEFT JOIN (
  SELECT
    campaign_id,
    count(*) AS total,
    count(*) FILTER (WHERE status = 'in_progress') AS in_progress,
    count(*) FILTER (WHERE status = 'success') AS success,
    count(*) FILTER (WHERE status = 'failed') AS failed
  FROM public.campaign_contacts
  GROUP BY campaign_id
) cc ON cc.campaign_id = rc.id
LEFT JOIN (
  SELECT
    (metadata->>'campaign_id')::uuid AS campaign_id,
    count(*) FILTER (WHERE (metadata->>'success') = 'true') AS send_ok,
    count(*) FILTER (WHERE (metadata->>'success') = 'false') AS send_fail,
    count(*) FILTER (WHERE (metadata->>'success') = 'true' AND metadata->>'type' = 'email') AS email_count,
    count(*) FILTER (WHERE (metadata->>'success') = 'true' AND metadata->>'type' = 'whatsapp') AS whatsapp_count
  FROM public.system_logs
  WHERE source = 'recurring-campaign-processor' AND metadata ? 'campaign_id'
  GROUP BY (metadata->>'campaign_id')::uuid
) sl ON sl.campaign_id = rc.id
LEFT JOIN (
  SELECT campaign_id, SUM(COALESCE(duration_seconds, 0)) AS call_seconds
  FROM public.voice_calls
  WHERE campaign_id IS NOT NULL
  GROUP BY campaign_id
) vc ON vc.campaign_id = rc.id
CROSS JOIN LATERAL (
  SELECT cost_per_email, cost_per_whatsapp_message, cost_per_call_minute
  FROM public.integration_settings
  ORDER BY (aws_ses_enabled OR whatsapp_enabled) DESC, created_at ASC
  LIMIT 1
) settings;

GRANT SELECT ON public.recurring_campaigns_live TO anon, authenticated;

-- get_recurring_campaign_stats(): soma o custo real (view) em vez do
-- campo actual_cost cru (que nunca é escrito, sempre 0).
CREATE OR REPLACE FUNCTION public.get_recurring_campaign_stats()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'active_campaigns', (
      SELECT COUNT(*) FROM public.recurring_campaigns WHERE status = 'active'
    ),
    'active_contacts', (
      SELECT COUNT(*) FROM public.campaign_contacts WHERE status = 'in_progress'
    ),
    'success_rate', (
      SELECT COALESCE(ROUND(
        (COUNT(*) FILTER (WHERE (metadata->>'success') = 'true')::DECIMAL /
         NULLIF(COUNT(*), 0) * 100), 1
      ), 0)
      FROM public.system_logs
      WHERE source = 'recurring-campaign-processor' AND metadata ? 'success'
    ),
    'total_cost', (
      SELECT COALESCE(SUM(actual_cost), 0) FROM public.recurring_campaigns_live
    )
  ) INTO result;
  RETURN result;
END;
$function$;
