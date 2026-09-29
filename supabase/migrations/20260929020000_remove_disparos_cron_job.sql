-- Disparos foi removido do produto (substituído por Campanhas de 1 dia,
-- que já ganhou paginação anti-ban/A-B/blacklist). Tabelas campaigns/
-- campaign_leads/campaign_variations/campaign_send_rules/campaign_blacklist
-- ficam intactas para preservar o histórico — só o processador para de
-- rodar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-campaigns-every-30s') THEN
    PERFORM cron.unschedule('process-campaigns-every-30s');
  END IF;
END $$;
