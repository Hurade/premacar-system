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

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_conversation_per_connection
ON public.conversations (contact_id, connection_id, api_source)
WHERE is_active = true AND connection_id IS NOT NULL;
