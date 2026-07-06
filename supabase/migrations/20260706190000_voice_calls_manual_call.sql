-- ============================================================
-- FASE 3.2: Centralizar telefonia (Twilio) como canal operacional
-- ============================================================

-- Habilita Realtime na tabela (hoje ausente — necessário para a UI
-- acompanhar o status da ligação em tempo real no chat)
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_calls;

-- Rastreia origem da ligação (manual via Chat vs. automática de campanha)
-- e quem disparou, para exibir na UI e auditoria.
ALTER TABLE public.voice_calls
  ADD COLUMN IF NOT EXISTS call_type TEXT NOT NULL DEFAULT 'campaign' CHECK (call_type IN ('campaign', 'manual')),
  ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_voice_calls_contact_id ON public.voice_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_created_at ON public.voice_calls(created_at DESC);

-- RLS de voice_calls ainda estava presa ao modelo antigo (por contacts.user_id),
-- que nunca foi revertido para o padrão permissivo — alinhando aqui.
DROP POLICY IF EXISTS "Users manage own voice_calls" ON public.voice_calls;
CREATE POLICY "Authenticated users can access all voice_calls"
ON public.voice_calls FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
