-- ============================================================
-- "Siga-me": quando o contato manda mensagem numa conversa já em
-- modo humano com atendente atribuído, e o atendente não responde em
-- N minutos, o sistema manda um aviso pro atendente (via WhatsApp, no
-- notification_phone dele) com um resumo de quem é o contato e o que
-- ele precisa. Liga por padrão pra todo mundo (atual e futuro).
-- ============================================================

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS follow_me_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS follow_me_delay_minutes INTEGER NOT NULL DEFAULT 5;

-- Guarda a última mensagem do contato sobre a qual já avisamos o
-- atendente, pra não avisar de novo a cada execução do processador
-- enquanto a mesma mensagem seguir sem resposta.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS follow_me_notified_message_id UUID REFERENCES public.messages(id);
