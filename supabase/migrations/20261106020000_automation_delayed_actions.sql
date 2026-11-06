-- Motor de delay nativo para Automações: uma ação de automation_rules pode
-- levar um delay_hours (campo dentro do jsonb actions, sem precisar de
-- ALTER TABLE) — quando tem, o automation-executor não executa na hora,
-- só agenda aqui. O automation-delayed-processor (cron a cada minuto)
-- processa o que já venceu.

CREATE TABLE public.automation_delayed_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  conversation_id UUID,
  deal_id UUID,
  action JSONB NOT NULL,
  run_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','executed','failed','cancelled')),
  error_message TEXT,
  chain_depth INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_delayed_actions_due ON public.automation_delayed_actions(run_at) WHERE status = 'pending';
CREATE INDEX idx_automation_delayed_actions_contact_id ON public.automation_delayed_actions(contact_id);

ALTER TABLE public.automation_delayed_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read automation_delayed_actions"
  ON public.automation_delayed_actions FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');
-- Sem policy de escrita para 'authenticated': só o automation-executor e o
-- automation-delayed-processor (service_role) gravam/atualizam aqui.

GRANT SELECT ON public.automation_delayed_actions TO authenticated;
GRANT ALL ON public.automation_delayed_actions TO service_role;

SELECT cron.schedule(
  'automation-delayed-processor-every-minute',
  '* * * * *',
  $$SELECT net.http_post(
    url := 'https://qzvswhfjuxfebpvlbysd.supabase.co/functions/v1/automation-delayed-processor',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6dnN3aGZqdXhmZWJwdmxieXNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwNTkzMDcsImV4cCI6MjEwNTYzNTMwN30.QXrj6H7_u1-yki6UcDqKso_fclD-y58BpTi8OsrEkGQ"}'::jsonb,
    body := '{}'::jsonb
  );$$
);
