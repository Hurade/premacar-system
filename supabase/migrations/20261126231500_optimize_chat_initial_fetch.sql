CREATE INDEX IF NOT EXISTS idx_messages_conversation_sent_at
  ON public.messages (conversation_id, sent_at DESC);

CREATE OR REPLACE FUNCTION public.fetch_interacted_dispatch_conversation_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(interacted.id ORDER BY interacted.last_message_at DESC), '{}'::uuid[])
  FROM (
    SELECT c.id, c.last_message_at
    FROM public.conversations AS c
    WHERE c.is_active
      AND c.dispatch_sent_at IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.messages AS m
        WHERE m.conversation_id = c.id
          AND m.from_type IN ('user', 'human')
      )
    ORDER BY c.last_message_at DESC
    LIMIT 50
  ) AS interacted;
$$;

CREATE OR REPLACE FUNCTION public.fetch_recent_chat_messages(p_conversation_ids uuid[])
RETURNS SETOF public.messages
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH ranked AS (
    SELECT
      m.id,
      m.conversation_id,
      m.sent_at,
      row_number() OVER (
        PARTITION BY m.conversation_id
        ORDER BY m.sent_at DESC, m.id DESC
      ) AS position
    FROM public.messages AS m
    WHERE m.conversation_id = ANY(p_conversation_ids)
  )
  SELECT m.*
  FROM ranked AS r
  JOIN public.messages AS m ON m.id = r.id
  WHERE r.position <= 100
  ORDER BY r.conversation_id, r.sent_at DESC, r.id DESC;
$$;

REVOKE ALL ON FUNCTION public.fetch_interacted_dispatch_conversation_ids() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fetch_recent_chat_messages(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_interacted_dispatch_conversation_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_recent_chat_messages(uuid[]) TO authenticated;
