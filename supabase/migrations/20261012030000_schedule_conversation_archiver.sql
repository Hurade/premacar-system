-- "Atendimentos Abertos" só crescia pra sempre — não existia nenhum jeito
-- de uma conversa em modo IA sair desse estado quando o cliente some e
-- nunca mais responde (560 das 564 estavam paradas há mais de 90 dias).
-- Roda uma vez por dia, junto com os outros resets diários, arquivando
-- (is_active=false) quem ficou mais de 7 dias sem mensagem em modo IA.
SELECT cron.schedule(
  'conversation-archiver-daily',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/conversation-archiver',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnN3aGZqdXhmZWJwdmxieXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTkzMDcsImV4cCI6MjEwNTYzNTMwN30.QXrj6H7_u1-yki6UcDqKso_fclD-y58BpTi8OsrEkGQ"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
