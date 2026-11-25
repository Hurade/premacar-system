-- Bug: assign_next_owner_round_robin() sorteava entre TODOS os atendentes
-- ativos da empresa, sem olhar se a pessoa realmente atende a fila da
-- conversa/deal. Resultado: conversa da fila Comercial (só o Marco é
-- membro) caía atribuída a "vitor schappo" ou "Brenner" — gente que nem
-- está cadastrada nessa fila.
--
-- Fix: função ganha p_queue_id opcional — quando informado, o sorteio só
-- roda entre membros de queue_members daquela fila. Sem o parâmetro,
-- mantém o comportamento antigo (compat com qualquer outro chamador).
CREATE OR REPLACE FUNCTION public.assign_next_owner_round_robin(p_queue_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_weight INTEGER;
  v_chosen_id UUID;
  v_ignore_schedule_fallback BOOLEAN;
  v_use_schedule_filter BOOLEAN := true;
  v_use_queue_filter BOOLEAN := p_queue_id IS NOT NULL;
BEGIN
  INSERT INTO public.round_robin_state (team_member_id, current_weight)
  SELECT id, 0 FROM public.team_members WHERE status = 'active'
  ON CONFLICT (team_member_id) DO NOTHING;

  SELECT COALESCE(round_robin_ignore_schedule_if_none_available, true) INTO v_ignore_schedule_fallback
  FROM public.nina_settings LIMIT 1;

  SELECT COALESCE(SUM(tm.weight), 0) INTO v_total_weight
  FROM public.team_members tm
  WHERE tm.status = 'active'
    AND public.is_team_member_available_now(tm.id)
    AND (NOT v_use_queue_filter OR EXISTS (
      SELECT 1 FROM public.queue_members qm
      WHERE qm.team_member_id = tm.id AND qm.queue_id = p_queue_id
    ));

  IF v_total_weight = 0 AND v_ignore_schedule_fallback THEN
    v_use_schedule_filter := false;
    SELECT COALESCE(SUM(tm.weight), 0) INTO v_total_weight
    FROM public.team_members tm
    WHERE tm.status = 'active'
      AND (NOT v_use_queue_filter OR EXISTS (
        SELECT 1 FROM public.queue_members qm
        WHERE qm.team_member_id = tm.id AND qm.queue_id = p_queue_id
      ));
  END IF;

  IF v_total_weight = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.round_robin_state rrs
  SET current_weight = rrs.current_weight + tm.weight
  FROM public.team_members tm
  WHERE tm.id = rrs.team_member_id
    AND tm.status = 'active'
    AND (NOT v_use_schedule_filter OR public.is_team_member_available_now(tm.id))
    AND (NOT v_use_queue_filter OR EXISTS (
      SELECT 1 FROM public.queue_members qm
      WHERE qm.team_member_id = tm.id AND qm.queue_id = p_queue_id
    ));

  SELECT rrs.team_member_id INTO v_chosen_id
  FROM public.round_robin_state rrs
  JOIN public.team_members tm ON tm.id = rrs.team_member_id
  WHERE tm.status = 'active'
    AND (NOT v_use_schedule_filter OR public.is_team_member_available_now(tm.id))
    AND (NOT v_use_queue_filter OR EXISTS (
      SELECT 1 FROM public.queue_members qm
      WHERE qm.team_member_id = tm.id AND qm.queue_id = p_queue_id
    ))
  ORDER BY rrs.current_weight DESC, rrs.team_member_id ASC
  LIMIT 1;

  UPDATE public.round_robin_state
  SET current_weight = current_weight - v_total_weight,
      last_assigned_at = now(),
      updated_at = now()
  WHERE team_member_id = v_chosen_id;

  RETURN v_chosen_id;
END;
$function$;

-- Trigger de criação de deal/conversa passa a sortear dentro da fila da
-- própria conversa (NEW.queue_id), e só propaga o sorteio pro
-- assigned_user_id da CONVERSA quando ela não nasce em atendimento por IA
-- ('nina') — enquanto for só IA, ninguém humano está de fato responsável
-- ainda, então o badge de atendente fica vazio até a transferência real
-- pra humano (nina-orchestrator) ou até alguém responder de verdade
-- (auto-assign no envio, em api.ts). O deal (CRM) continua recebendo dono
-- por rodízio normalmente — só a conversa que deixa de ser pré-atribuída.
CREATE OR REPLACE FUNCTION public.create_deal_for_new_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_id    UUID;
  v_stage_title TEXT;
  v_user_id     UUID;
  v_title       TEXT;
  v_owner_id    UUID;
BEGIN
  IF current_setting('app.skip_deal_trigger', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Idempotente: contato já tem deal → não duplicar
  IF EXISTS (
    SELECT 1 FROM public.deals WHERE contact_id = NEW.contact_id LIMIT 1
  ) THEN
    RETURN NEW;
  END IF;

  -- Dados do contato
  SELECT user_id,
         COALESCE(name, call_name, phone_number, 'Novo Lead')
  INTO   v_user_id, v_title
  FROM   public.contacts
  WHERE  id = NEW.contact_id;

  -- Primeiro estágio ativo do mesmo user_id
  SELECT id, title
  INTO   v_stage_id, v_stage_title
  FROM   public.pipeline_stages
  WHERE  is_active = true
    AND  user_id = COALESCE(NEW.user_id, v_user_id)
  ORDER  BY position
  LIMIT  1;

  -- Fallback: qualquer estágio ativo (cobre webhooks sem user_id)
  IF v_stage_id IS NULL THEN
    SELECT id, title
    INTO   v_stage_id, v_stage_title
    FROM   public.pipeline_stages
    WHERE  is_active = true
    ORDER  BY position
    LIMIT  1;
  END IF;

  IF v_stage_id IS NULL THEN
    RAISE NOTICE '[create_deal_for_new_conversation] Nenhum estágio encontrado, pulando deal para contato %', NEW.contact_id;
    RETURN NEW;
  END IF;

  -- Só sorteia dono se a conversa não chegou já com um responsável
  -- explícito (ex: atendente que clicou em "Nova Conversa" a partir do
  -- contato) — nesse caso o round-robin ficaria por conta própria e
  -- sobrescreveria a atribuição que já deveria valer. Sorteio restrito aos
  -- membros da fila da conversa (NEW.queue_id).
  IF NEW.assigned_user_id IS NULL THEN
    v_owner_id := public.assign_next_owner_round_robin(NEW.queue_id);
  ELSE
    v_owner_id := NEW.assigned_user_id;
  END IF;

  INSERT INTO public.deals (contact_id, title, stage, stage_id, priority, user_id, owner_id)
  VALUES (
    NEW.contact_id,
    v_title,
    v_stage_title,
    v_stage_id,
    'medium',
    COALESCE(NEW.user_id, v_user_id),
    v_owner_id
  );

  -- Propaga a atribuição sorteada pra conversa só quando ela já nasce fora
  -- do atendimento por IA — com 'nina' ainda ativo, ninguém humano é
  -- responsável de fato, então não faz sentido pré-atribuir um atendente.
  IF NEW.assigned_user_id IS NULL AND v_owner_id IS NOT NULL AND NEW.status IS DISTINCT FROM 'nina' THEN
    UPDATE public.conversations
    SET assigned_user_id = v_owner_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
