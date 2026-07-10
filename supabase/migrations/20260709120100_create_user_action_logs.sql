-- ============================================================
-- Registro de Atividades (audit log de ações humanas).
--
-- Distinto de `system_logs` (que é log técnico de edge functions:
-- erros/warnings de processamento). Esta tabela registra ações
-- iniciadas por usuários no app (atribuir conversa, mesclar
-- contatos, mudar papel de membro, etc). Escrita vem do cliente
-- (sessão autenticada do próprio usuário), por isso a policy é
-- de leitura+escrita para `authenticated`, seguindo a convenção
-- já usada no projeto para tabelas sem isolamento por owner.
-- ============================================================

CREATE TABLE public.user_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_action_logs_actor ON public.user_action_logs(actor_id);
CREATE INDEX idx_user_action_logs_entity ON public.user_action_logs(entity_type, entity_id);
CREATE INDEX idx_user_action_logs_created ON public.user_action_logs(created_at DESC);
CREATE INDEX idx_user_action_logs_action ON public.user_action_logs(action);

ALTER TABLE public.user_action_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage user_action_logs"
  ON public.user_action_logs FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
