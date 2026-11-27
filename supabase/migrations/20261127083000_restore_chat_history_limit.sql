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
  WHERE r.position <= 1000
  ORDER BY r.conversation_id, r.sent_at DESC, r.id DESC;
$$;

REVOKE ALL ON FUNCTION public.fetch_recent_chat_messages(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_recent_chat_messages(uuid[]) TO authenticated;
