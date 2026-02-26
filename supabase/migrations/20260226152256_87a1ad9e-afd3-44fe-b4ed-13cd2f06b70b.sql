
-- Function to get campaign funnel data
CREATE OR REPLACE FUNCTION public.get_campaign_funnel(p_campaign_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  total_count INT;
  day1_count INT;
  day2_count INT;
  day3_count INT;
  day4_count INT;
  day5_count INT;
  success_count INT;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE current_day >= 1),
    COUNT(*) FILTER (WHERE current_day >= 2),
    COUNT(*) FILTER (WHERE current_day >= 3),
    COUNT(*) FILTER (WHERE current_day >= 4),
    COUNT(*) FILTER (WHERE current_day >= 5),
    COUNT(*) FILTER (WHERE status = 'success')
  INTO 
    total_count, day1_count, day2_count, day3_count, day4_count, day5_count, success_count
  FROM public.campaign_contacts
  WHERE campaign_id = p_campaign_id;

  result := json_build_array(
    json_build_object('label', 'Iniciados', 'icon', '👥', 'count', total_count),
    json_build_object('label', 'Dia 1', 'icon', '📞', 'count', day1_count),
    json_build_object('label', 'Dia 2', 'icon', '💬', 'count', day2_count),
    json_build_object('label', 'Dia 3', 'icon', '📧', 'count', day3_count),
    json_build_object('label', 'Dia 4', 'icon', '💬', 'count', day4_count),
    json_build_object('label', 'Dia 5', 'icon', '🔄', 'count', day5_count),
    json_build_object('label', 'Convertidos', 'icon', '✅', 'count', success_count)
  );

  RETURN result;
END;
$$;
