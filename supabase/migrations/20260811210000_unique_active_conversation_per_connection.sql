-- ============================================================
-- Evita conversas duplicadas quando o cliente manda várias mensagens em
-- sequência rápida (ex.: 2 mensagens do WhatsApp chegam quase juntas,
-- disparando 2 execuções concorrentes do webhook). Sem essa trava, as
-- duas checavam "existe conversa ativa?" antes de qualquer uma ter
-- inserido a sua, e as duas criavam uma conversa nova pro mesmo
-- contato+conexão.
--
-- Escopado a connection_id NOT NULL: conversas legadas sem conexão
-- (connection_id NULL, de antes do multi-conexão) não entram nessa
-- trava — não é o caso que estamos corrigindo agora, e um índice único
-- incluindo NULL não teria efeito prático mesmo (Postgres trata cada
-- NULL como distinto).
-- ============================================================

-- Antes de criar o índice: mescla duplicatas que já existem hoje em
-- produção (CREATE UNIQUE INDEX falha se os dados já violarem a
-- constraint). Sobrevivente = a mais antiga do grupo; as outras têm as
-- mensagens movidas pra ela e são desativadas (não apagadas).
DO $$
DECLARE
  grp RECORD;
  survivor_id uuid;
  max_last_message timestamptz;
BEGIN
  FOR grp IN
    SELECT contact_id, connection_id, api_source
    FROM public.conversations
    WHERE is_active = true AND connection_id IS NOT NULL
    GROUP BY contact_id, connection_id, api_source
    HAVING count(*) > 1
  LOOP
    SELECT id INTO survivor_id
    FROM public.conversations
    WHERE contact_id = grp.contact_id AND connection_id = grp.connection_id
      AND api_source = grp.api_source AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    UPDATE public.messages
    SET conversation_id = survivor_id
    WHERE conversation_id IN (
      SELECT id FROM public.conversations
      WHERE contact_id = grp.contact_id AND connection_id = grp.connection_id
        AND api_source = grp.api_source AND is_active = true AND id <> survivor_id
    );

    SELECT max(sent_at) INTO max_last_message FROM public.messages WHERE conversation_id = survivor_id;
    IF max_last_message IS NOT NULL THEN
      UPDATE public.conversations SET last_message_at = max_last_message, updated_at = now() WHERE id = survivor_id;
    END IF;

    UPDATE public.conversations
    SET is_active = false, status = 'paused'
    WHERE contact_id = grp.contact_id AND connection_id = grp.connection_id
      AND api_source = grp.api_source AND is_active = true AND id <> survivor_id;

    RAISE NOTICE 'Mesclado grupo duplicado: contact_id=%, connection_id=%, sobrevivente=%', grp.contact_id, grp.connection_id, survivor_id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_conversation_per_connection
ON public.conversations (contact_id, connection_id, api_source)
WHERE is_active = true AND connection_id IS NOT NULL;
