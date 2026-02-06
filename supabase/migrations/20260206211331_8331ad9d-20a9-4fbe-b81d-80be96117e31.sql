-- Função para incrementar contadores de campanha de forma atômica (evita race conditions)
CREATE OR REPLACE FUNCTION public.increment_campaign_counter(
  p_campaign_id UUID,
  p_counter TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  CASE p_counter
    WHEN 'total_delivered' THEN
      UPDATE campaigns SET total_delivered = COALESCE(total_delivered, 0) + 1 WHERE id = p_campaign_id;
    WHEN 'total_read' THEN
      UPDATE campaigns SET total_read = COALESCE(total_read, 0) + 1 WHERE id = p_campaign_id;
    WHEN 'total_replied' THEN
      UPDATE campaigns SET total_replied = COALESCE(total_replied, 0) + 1 WHERE id = p_campaign_id;
    WHEN 'total_sent' THEN
      UPDATE campaigns SET total_sent = COALESCE(total_sent, 0) + 1 WHERE id = p_campaign_id;
    WHEN 'total_errors' THEN
      UPDATE campaigns SET total_errors = COALESCE(total_errors, 0) + 1 WHERE id = p_campaign_id;
    ELSE
      RAISE EXCEPTION 'Unknown counter: %', p_counter;
  END CASE;
END;
$$;