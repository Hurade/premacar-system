-- ============================================================
-- Bug: create_deal_for_new_conversation() gravava conversations.assigned_user_id
-- com o auth user_id do atendente sorteado (v_owner_user_id), quando essa
-- coluna sempre foi usada em todo o resto do app como team_members.id
-- (ver assignConversation/api.assignConversation, useUserRole.teamMemberId,
-- e a correção de auto-atribuição em api.sendMessage). Resultado: a tela
-- nunca conseguia mostrar o nome do atendente atribuído automaticamente
-- por esse trigger — a busca por team_members sempre dava vazio.
-- ============================================================

-- PARTE 1: corrige os dados já gravados errados. Detecta pelo valor não
-- bater com nenhum team_members.id, mas bater com o user_id de algum
-- membro — nesse caso, troca pelo id certo.
UPDATE public.conversations c
SET assigned_user_id = tm.id
FROM public.team_members tm
WHERE c.assigned_user_id = tm.user_id
  AND NOT EXISTS (SELECT 1 FROM public.team_members tm2 WHERE tm2.id = c.assigned_user_id);

-- PARTE 2: corrige o trigger pra não repetir o erro em conversas futuras —
-- grava direto o team_members.id sorteado (v_owner_id), sem precisar
-- traduzir para o auth user_id.
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

  -- Propaga a mesma atribuição para a conversa — assigned_user_id é
  -- team_members.id em todo o resto do app, não auth user_id.
  IF v_owner_id IS NOT NULL THEN
    UPDATE public.conversations
    SET assigned_user_id = v_owner_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
