-- A Meta não avisa quando aprova/rejeita um template (sem webhook) — só dá
-- pra saber perguntando. Roda a cada 30 minutos (mesma cadência do
-- followup-processor), consultando só os templates "pending" com
-- meta_template_id (já enviados de verdade).
SELECT cron.schedule(
  'check-meta-template-status-every-30min',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/check-meta-template-status',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnN3aGZqdXhmZWJwdmxieXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTkzMDcsImV4cCI6MjEwNTYzNTMwN30.QXrj6H7_u1-yki6UcDqKso_fclD-y58BpTi8OsrEkGQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;$$
);
