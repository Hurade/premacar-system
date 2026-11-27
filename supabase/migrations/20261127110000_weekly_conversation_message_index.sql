CREATE OR REPLACE FUNCTION public.fetch_conversation_message_weeks(p_conversation_ids uuid[])
RETURNS TABLE (
  conversation_id uuid,
  week_start date,
  message_count bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT
    m.conversation_id,
    date_trunc('week', m.sent_at AT TIME ZONE 'UTC')::date AS week_start,
    count(*) AS message_count
  FROM public.messages AS m
  WHERE m.conversation_id = ANY(p_conversation_ids)
  GROUP BY m.conversation_id, date_trunc('week', m.sent_at AT TIME ZONE 'UTC')::date
  ORDER BY m.conversation_id, week_start DESC;
$$;

REVOKE ALL ON FUNCTION public.fetch_conversation_message_weeks(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fetch_conversation_message_weeks(uuid[]) TO authenticated;
