-- ============================================================
-- Avaliações de atendimento (CSAT).
--
-- Disparada ao finalizar uma conversa (useConversations.finalizeConversation):
-- cria a linha aqui com um token público e enfileira o link em
-- send_queue, reaproveitando o mesmo mecanismo de envio que o
-- automation-executor já usa para a ação `send_message`.
--
-- A tabela em si não é exposta para `anon` — a resposta pública
-- (rota /csat/:token, sem login) grava via a função
-- `public.submit_csat_response`, que só aceita update casando o
-- token e nunca lê/retorna outras linhas.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.csat_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_csat_surveys_conversation_id ON public.csat_surveys(conversation_id);
CREATE INDEX idx_csat_surveys_contact_id ON public.csat_surveys(contact_id);
CREATE INDEX idx_csat_surveys_token ON public.csat_surveys(token);

ALTER TABLE public.csat_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage csat_surveys"
  ON public.csat_surveys FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
-- Nenhuma policy para `anon`: a tabela não é lida/gravada direto pelo
-- visitante público, só através da função abaixo (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.submit_csat_response(p_token TEXT, p_rating SMALLINT, p_comment TEXT DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'submit_csat_response: rating must be between 1 and 5';
  END IF;

  UPDATE public.csat_surveys
  SET rating = p_rating,
      comment = p_comment,
      responded_at = now()
  WHERE token = p_token
    AND responded_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_csat_response(TEXT, SMALLINT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_csat_response(TEXT, SMALLINT, TEXT) TO anon, authenticated;

-- Leitura pública minimalista para renderizar a página /csat/:token antes
-- de responder (não expõe a tabela inteira, só o necessário para a UI).
CREATE OR REPLACE FUNCTION public.get_csat_survey_by_token(p_token TEXT)
RETURNS TABLE (already_responded boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT (responded_at IS NOT NULL) AS already_responded
  FROM public.csat_surveys
  WHERE token = p_token;
END;
$$;

REVOKE ALL ON FUNCTION public.get_csat_survey_by_token(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.get_csat_survey_by_token(TEXT) TO anon, authenticated;
