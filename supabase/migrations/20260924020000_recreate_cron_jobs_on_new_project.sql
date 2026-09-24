-- Recria os jobs de pg_cron do projeto antigo (Lovable) neste projeto.
--
-- Esses jobs NUNCA foram versionados em migration histórica — sempre foram
-- criados via SQL direto no SQL Editor do Lovable (cron.schedule() não deixa
-- rastro em nenhuma migration). Lista obtida rodando `select * from cron.job`
-- no projeto antigo (tkwwpcgmpemkrsubilhi) em 2026-09-24 e reproduzida aqui
-- apontando pra este projeto (URL + anon key trocados).
--
-- NÃO incluído: db-backup-sync-every-6h (sync pra Postgres externo/RDS,
-- decisão do usuário de não recriar — motivo de existir era contingência
-- por estar no Lovable Cloud, que não se aplica mais num projeto próprio).

SELECT cron.schedule(
  'process-campaigns-every-30s',
  '*/1 * * * *',
  $$SELECT net.http_post(
    url := 'https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/campaign-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnN3aGZqdXhmZWJwdmxieXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTkzMDcsImV4cCI6MjEwNTYzNTMwN30.QXrj6H7_u1-yki6UcDqKso_fclD-y58BpTi8OsrEkGQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;$$
);

SELECT cron.schedule(
  'recurring-campaign-processor-every-minute',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/recurring-campaign-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnN3aGZqdXhmZWJwdmxieXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTkzMDcsImV4cCI6MjEwNTYzNTMwN30.QXrj6H7_u1-yki6UcDqKso_fclD-y58BpTi8OsrEkGQ"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'invoke-nina-orchestrator-every-minute',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/nina-orchestrator',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnN3aGZqdXhmZWJwdmxieXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTkzMDcsImV4cCI6MjEwNTYzNTMwN30.QXrj6H7_u1-yki6UcDqKso_fclD-y58BpTi8OsrEkGQ"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;$$
);

SELECT cron.schedule(
  'followup-processor-every-30min',
  '*/30 * * * *',
  $$SELECT net.http_post(
    url := 'https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/followup-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnN3aGZqdXhmZWJwdmxieXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTkzMDcsImV4cCI6MjEwNTYzNTMwN30.QXrj6H7_u1-yki6UcDqKso_fclD-y58BpTi8OsrEkGQ"}'::jsonb,
    body := '{}'::jsonb
  );$$
);

SELECT cron.schedule(
  'message-grouper-safety-sweep',
  '* * * * *',
  $$select net.http_post(
    url:='https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/message-grouper',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnN3aGZqdXhmZWJwdmxieXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTkzMDcsImV4cCI6MjEwNTYzNTMwN30.QXrj6H7_u1-yki6UcDqKso_fclD-y58BpTi8OsrEkGQ"}'::jsonb,
    body:=concat('{"triggered_by": "cron-safety-sweep", "time": "', now(), '"}')::jsonb
  );$$
);
