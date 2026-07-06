-- ============================================================
-- FASE 2.1: Motor de automação configurável (v1, sem canvas visual)
--
-- Decisão de arquitetura: os gatilhos são disparados por chamadas explícitas
-- de código (edge function nina-orchestrator para 'new_message', função
-- api.moveDealStage para 'stage_changed', EditContactModal/Contacts.tsx para
-- 'tag_applied') em vez de triggers de banco com pg_net. Motivo: os poucos
-- pontos de escrita reais já são centralizados/mapeáveis, e chamar a edge
-- function diretamente do código que já faz a escrita é mais simples de
-- testar e depurar do que configurar pg_net + URL/segredo via GUC do
-- Postgres (que exigiria acesso ao painel do Supabase para configurar).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('new_message', 'tag_applied', 'stage_changed')),
  trigger_config JSONB NOT NULL DEFAULT '{}', -- ex.: {"tag": "quente"} ou {"to_stage_id": "..."}
  conditions JSONB NOT NULL DEFAULT '[]',      -- [{ field, operator, value }]
  conditions_logic TEXT NOT NULL DEFAULT 'AND' CHECK (conditions_logic IN ('AND', 'OR')),
  actions JSONB NOT NULL DEFAULT '[]',         -- [{ type, params }], executadas em ordem
  priority INTEGER NOT NULL DEFAULT 0,
  run_once_per_contact BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.automation_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  contact_id UUID,
  conversation_id UUID,
  deal_id UUID,
  trigger_payload JSONB,
  conditions_result BOOLEAN,
  actions_result JSONB,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'partial', 'error', 'skipped')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_trigger_type ON public.automation_rules(trigger_type, is_active);
CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_rule_id ON public.automation_execution_logs(rule_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_execution_logs_contact_id ON public.automation_execution_logs(contact_id);

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage automation_rules"
  ON public.automation_rules FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read automation_execution_logs"
  ON public.automation_execution_logs FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');
-- Sem policy de escrita para 'authenticated' em automation_execution_logs:
-- só a edge function automation-executor (service_role) grava logs.

-- run_once_per_contact: rastreia se uma regra já rodou para um contato,
-- usado para não repetir automações "de boas-vindas" a cada mensagem nova.
CREATE TABLE IF NOT EXISTS public.automation_rule_runs (
  rule_id UUID NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL,
  first_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, contact_id)
);

ALTER TABLE public.automation_rule_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read automation_rule_runs"
  ON public.automation_rule_runs FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');
