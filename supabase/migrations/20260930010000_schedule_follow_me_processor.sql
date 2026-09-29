-- follow-me-processor existe desde 20260912010000 (feat "Siga-me": avisa o
-- atendente por WhatsApp se ele não responder um cliente em N minutos), mas
-- nunca foi agendado via pg_cron — nem no projeto antigo, nem aqui. O toggle
-- na tela de Equipe (follow_me_enabled) nunca teve efeito real porque nada
-- chamava a function. A cada minuto, igual aos outros processadores
-- correlatos.
SELECT cron.schedule(
  'follow-me-processor-every-minute',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/follow-me-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnN3aGZqdXhmZWJwdmxieXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTkzMDcsImV4cCI6MjEwNTYzNTMwN30.QXrj6H7_u1-yki6UcDqKso_fclD-y58BpTi8OsrEkGQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;$$
);
