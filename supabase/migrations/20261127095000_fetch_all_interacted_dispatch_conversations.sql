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
  ) AS interacted;
$$;

REVOKE ALL ON FUNCTION public.fetch_interacted_dispatch_conversation_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_interacted_dispatch_conversation_ids() TO authenticated;
