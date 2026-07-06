-- ============================================================
-- FASE 1.1: Atribui automaticamente um owner (round-robin) aos
-- deals criados pelas triggers de "novo contato"/"nova conversa",
-- e propaga a atribuição para conversations.assigned_user_id.
-- ============================================================

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
  v_owner_user_id UUID;
BEGIN
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

  v_owner_id := public.assign_next_owner_round_robin();

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

  -- Propaga a mesma atribuição para a conversa, se o membro sorteado
  -- já tiver feito login ao menos uma vez (user_id preenchido)
  IF v_owner_id IS NOT NULL THEN
    SELECT user_id INTO v_owner_user_id FROM public.team_members WHERE id = v_owner_id;

    IF v_owner_user_id IS NOT NULL THEN
      UPDATE public.conversations
      SET assigned_user_id = v_owner_user_id
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_deal_for_new_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_id    UUID;
  v_stage_title TEXT;
  v_owner_id    UUID;
BEGIN
  -- Idempotente: já existe deal para este contato
  IF EXISTS (
    SELECT 1 FROM public.deals WHERE contact_id = NEW.id LIMIT 1
  ) THEN
    RETURN NEW;
  END IF;

  -- Primeiro estágio ativo do mesmo user_id
  SELECT id, title
  INTO   v_stage_id, v_stage_title
  FROM   public.pipeline_stages
  WHERE  is_active = true
    AND  user_id = NEW.user_id
  ORDER  BY position
  LIMIT  1;

  -- Fallback: qualquer estágio ativo (cobre imports sem user_id)
  IF v_stage_id IS NULL THEN
    SELECT id, title
    INTO   v_stage_id, v_stage_title
    FROM   public.pipeline_stages
    WHERE  is_active = true
    ORDER  BY position
    LIMIT  1;
  END IF;

  IF v_stage_id IS NULL THEN
    RAISE NOTICE '[create_deal_for_new_contact] Nenhum estágio encontrado para contato %', NEW.id;
    RETURN NEW;
  END IF;

  v_owner_id := public.assign_next_owner_round_robin();

  INSERT INTO public.deals (contact_id, title, stage, stage_id, priority, user_id, owner_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, NEW.call_name, NEW.phone_number, 'Novo Lead'),
    v_stage_title,
    v_stage_id,
    'medium',
    NEW.user_id,
    v_owner_id
  );

  RETURN NEW;
END;
$function$;
