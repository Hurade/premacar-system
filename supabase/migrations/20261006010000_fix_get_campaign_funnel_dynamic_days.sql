-- get_campaign_funnel tinha os ícones e o número de dias (sempre 5: ligação,
-- whatsapp, email, whatsapp, reativação) FIXOS no código, sem olhar pro
-- flow_config real da campanha. Uma campanha como "De volta ao Prema"
-- (7 dias, email/whatsapp alternados) aparecia com o dia 1 como "📞 ligação"
-- mesmo sendo e-mail, e sempre só 5 estágios independente de quantos dias a
-- campanha realmente tem. Agora lê flow_config e monta os estágios
-- dinamicamente, um por dia configurado (enabled), com o ícone certo por
-- tipo.
CREATE OR REPLACE FUNCTION public.get_campaign_funnel(p_campaign_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result JSON;
  total_count INT;
  success_count INT;
  v_flow_config JSONB;
  v_day_keys TEXT[];
  v_day_key TEXT;
  v_day_num INT;
  v_day_type TEXT;
  v_icon TEXT;
  v_day_count INT;
  v_stages JSON[] := ARRAY[]::JSON[];
BEGIN
  SELECT flow_config INTO v_flow_config
  FROM public.recurring_campaigns
  WHERE id = p_campaign_id;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'success')
  INTO total_count, success_count
  FROM public.campaign_contacts
  WHERE campaign_id = p_campaign_id;

  v_stages := v_stages || json_build_object('label', 'Iniciados', 'icon', '👥', 'count', total_count);

  -- Chaves "day1".."dayN" ordenadas numericamente (não alfabeticamente —
  -- senão "day10" viria antes de "day2").
  SELECT array_agg(key ORDER BY substring(key FROM 4)::int)
  INTO v_day_keys
  FROM jsonb_object_keys(COALESCE(v_flow_config, '{}'::jsonb)) AS key
  WHERE key ~ '^day\d+$' AND (v_flow_config->key->>'enabled')::boolean IS NOT FALSE;

  FOREACH v_day_key IN ARRAY COALESCE(v_day_keys, ARRAY[]::TEXT[])
  LOOP
    v_day_num := substring(v_day_key FROM 4)::int;
    v_day_type := v_flow_config->v_day_key->>'type';
    v_icon := CASE v_day_type
      WHEN 'email' THEN '📧'
      WHEN 'whatsapp' THEN '💬'
      WHEN 'call' THEN '📞'
      WHEN 'sms' THEN '✉️'
      ELSE '🔄'
    END;

    SELECT COUNT(*) INTO v_day_count
    FROM public.campaign_contacts
    WHERE campaign_id = p_campaign_id AND current_day >= v_day_num;

    v_stages := v_stages || json_build_object(
      'label', 'Dia ' || v_day_num,
      'icon', v_icon,
      'count', v_day_count
    );
  END LOOP;

  v_stages := v_stages || json_build_object('label', 'Convertidos', 'icon', '✅', 'count', success_count);

  RETURN array_to_json(v_stages);
END;
$function$;
