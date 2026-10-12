-- recurring_campaigns.total_contacts/success_count/failed_count/in_progress_count
-- são contadores em cache, incrementados POR ENVIO BEM-SUCEDIDO (cada e-mail,
-- cada WhatsApp de cada dia), não por CONTATO que terminou a campanha. Numa
-- campanha de 7 dias, um contato gera até 7 incrementos de "sucesso" — por
-- isso já vimos success_count (143) passar do total_contacts (72), e a tela
-- de Campanhas mostrar taxa de sucesso impossível (>100%) no card, ou 0%
-- no resumo geral (que olha certo pro status real do contato, mas qualquer
-- campanha de vários dias ainda em andamento mostra 0% por semanas, já que
-- ninguém "terminou tudo" ainda).
--
-- Essa view recalcula total/in_progress/success/failed direto de
-- campaign_contacts.status (contagem por CONTATO, sempre correta, sem
-- depender de incrementos acumulados) e adiciona send_success_count/
-- send_failed_count a partir de system_logs (contagem por ENVIO, pra medir
-- "os disparos estão funcionando" mesmo com a campanha ainda em andamento).
-- Mantém os mesmos nomes de coluna de recurring_campaigns pros dois contact-
-- level fields, então o frontend que já lê total_contacts/success_count/
-- failed_count/in_progress_count passa a receber o valor certo sem mudança
-- de schema — só troca de onde lê (a view, não a tabela).
CREATE OR REPLACE VIEW public.recurring_campaigns_live AS
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
  rc.actual_cost,
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
    count(*) FILTER (WHERE (metadata->>'success') = 'false') AS send_fail
  FROM public.system_logs
  WHERE source = 'recurring-campaign-processor' AND metadata ? 'campaign_id'
  GROUP BY (metadata->>'campaign_id')::uuid
) sl ON sl.campaign_id = rc.id;

GRANT SELECT ON public.recurring_campaigns_live TO anon, authenticated;

-- get_recurring_campaign_stats(): mesmo problema no resumo geral da tela de
-- Campanhas — "Taxa de Sucesso" olhava campaign_contacts.status = 'success'
-- (contato terminou TODOS os dias), que fica em 0% por semanas em qualquer
-- campanha de vários dias ainda em andamento, mesmo com os envios
-- funcionando perfeitamente. Troca pra taxa de sucesso dos ENVIOS
-- (system_logs), que reflete saúde operacional de verdade desde o dia 1.
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
      SELECT COALESCE(SUM(actual_cost), 0) FROM public.recurring_campaigns
    )
  ) INTO result;
  RETURN result;
END;
$function$;
