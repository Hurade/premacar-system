-- ============================================================
-- FASE 3.4: Protocolo/número de ticket formal por atendimento
--
-- Gerado via trigger de banco (não em código de aplicação) para cobrir
-- automaticamente todos os pontos que hoje inserem em `conversations`
-- (webhooks Meta/Evolution, criação manual, disparos, etc.) sem precisar
-- alterar cada um deles.
-- ============================================================

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS protocol_number TEXT UNIQUE;

CREATE SEQUENCE IF NOT EXISTS public.conversation_protocol_seq;

CREATE OR REPLACE FUNCTION public.set_conversation_protocol_number()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.protocol_number IS NULL THEN
    NEW.protocol_number := to_char(NEW.created_at, 'YYYYMMDD') || '-' ||
      lpad(nextval('public.conversation_protocol_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_conversation_protocol_number ON public.conversations;
CREATE TRIGGER trg_set_conversation_protocol_number
BEFORE INSERT ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.set_conversation_protocol_number();

CREATE INDEX IF NOT EXISTS idx_conversations_protocol_number ON public.conversations(protocol_number);

-- Backfill de conversas existentes (ordem cronológica preserva sentido sequencial)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, created_at FROM public.conversations WHERE protocol_number IS NULL ORDER BY created_at ASC LOOP
    UPDATE public.conversations
    SET protocol_number = to_char(r.created_at, 'YYYYMMDD') || '-' || lpad(nextval('public.conversation_protocol_seq')::text, 6, '0')
    WHERE id = r.id;
  END LOOP;
END $$;
