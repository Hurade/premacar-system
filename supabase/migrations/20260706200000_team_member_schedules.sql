-- ============================================================
-- FASE 3.3: Horários de trabalho da equipe + integração com round-robin
-- ============================================================

CREATE TABLE IF NOT EXISTS public.team_member_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=domingo
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '18:00',
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_member_id, day_of_week),
  CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_tms_team_member_id ON public.team_member_schedules(team_member_id);
CREATE INDEX IF NOT EXISTS idx_tms_day_of_week ON public.team_member_schedules(day_of_week);

CREATE TRIGGER update_team_member_schedules_updated_at
  BEFORE UPDATE ON public.team_member_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.team_member_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage team_member_schedules"
  ON public.team_member_schedules FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Fallback global: se nenhum membro ativo estiver disponível no horário
-- configurado, o round-robin ignora o filtro de horário (não deixa o
-- lead sem dono fora do expediente de todo mundo).
ALTER TABLE public.nina_settings
  ADD COLUMN IF NOT EXISTS round_robin_ignore_schedule_if_none_available BOOLEAN NOT NULL DEFAULT true;

-- Um membro está disponível agora? Sem horário configurado = sempre
-- disponível (fallback retrocompatível para membros já existentes).
CREATE OR REPLACE FUNCTION public.is_team_member_available_now(p_team_member_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_now TIMESTAMPTZ := now() AT TIME ZONE 'America/Sao_Paulo';
  v_dow SMALLINT := EXTRACT(DOW FROM v_now)::SMALLINT;
  v_time TIME := v_now::TIME;
  v_has_schedule BOOLEAN;
  v_available BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM public.team_member_schedules WHERE team_member_id = p_team_member_id)
  INTO v_has_schedule;

  IF NOT v_has_schedule THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.team_member_schedules
    WHERE team_member_id = p_team_member_id
      AND day_of_week = v_dow
      AND is_available = true
      AND v_time BETWEEN start_time AND end_time
  ) INTO v_available;

  RETURN v_available;
END;
$$;

-- Round-robin passa a considerar horário de trabalho: só entram na
-- disputa membros ativos E disponíveis agora. Se ninguém estiver
-- disponível e o fallback estiver habilitado, ignora o filtro de horário
-- (evita deal sem dono fora do expediente de toda a equipe).
CREATE OR REPLACE FUNCTION public.assign_next_owner_round_robin()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_total_weight INTEGER;
  v_chosen_id UUID;
  v_ignore_schedule_fallback BOOLEAN;
  v_use_schedule_filter BOOLEAN := true;
BEGIN
  INSERT INTO public.round_robin_state (team_member_id, current_weight)
  SELECT id, 0 FROM public.team_members WHERE status = 'active'
  ON CONFLICT (team_member_id) DO NOTHING;

  SELECT COALESCE(round_robin_ignore_schedule_if_none_available, true) INTO v_ignore_schedule_fallback
  FROM public.nina_settings LIMIT 1;

  SELECT COALESCE(SUM(tm.weight), 0) INTO v_total_weight
  FROM public.team_members tm
  WHERE tm.status = 'active' AND public.is_team_member_available_now(tm.id);

  IF v_total_weight = 0 AND v_ignore_schedule_fallback THEN
    v_use_schedule_filter := false;
    SELECT COALESCE(SUM(tm.weight), 0) INTO v_total_weight
    FROM public.team_members tm
    WHERE tm.status = 'active';
  END IF;

  IF v_total_weight = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.round_robin_state rrs
  SET current_weight = rrs.current_weight + tm.weight
  FROM public.team_members tm
  WHERE tm.id = rrs.team_member_id
    AND tm.status = 'active'
    AND (NOT v_use_schedule_filter OR public.is_team_member_available_now(tm.id));

  SELECT rrs.team_member_id INTO v_chosen_id
  FROM public.round_robin_state rrs
  JOIN public.team_members tm ON tm.id = rrs.team_member_id
  WHERE tm.status = 'active'
    AND (NOT v_use_schedule_filter OR public.is_team_member_available_now(tm.id))
  ORDER BY rrs.current_weight DESC, rrs.team_member_id ASC
  LIMIT 1;

  UPDATE public.round_robin_state
  SET current_weight = current_weight - v_total_weight,
      last_assigned_at = now(),
      updated_at = now()
  WHERE team_member_id = v_chosen_id;

  RETURN v_chosen_id;
END;
$$;
