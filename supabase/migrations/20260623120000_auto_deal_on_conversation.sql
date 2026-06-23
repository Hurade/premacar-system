-- Cria deal automaticamente ao iniciar nova conversa (não apenas ao criar contato).
--
-- PROBLEMA CORRIGIDO:
-- O trigger existente (auto_create_deal_on_contact) só disparava no INSERT de contacts.
-- Isso não cobria contatos já existentes que iniciavam uma nova conversa,
-- resultado: a maioria das conversas chegava sem card no pipeline.
--
-- SOLUÇÃO:
-- 1. Novo trigger em conversations: cria deal se o contato ainda não tiver um.
-- 2. Atualiza o trigger em contacts com fallback de user_id mais robusto.
-- Ambos são idempotentes (verificam existência antes de inserir).

-- ─── 1. Função para o trigger em conversations ───────────────────────────────

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

  INSERT INTO public.deals (contact_id, title, stage, stage_id, priority, user_id)
  VALUES (
    NEW.contact_id,
    v_title,
    v_stage_title,
    v_stage_id,
    'medium',
    COALESCE(NEW.user_id, v_user_id)
  );

  RETURN NEW;
END;
$function$;

-- Trigger na tabela conversations
DROP TRIGGER IF EXISTS auto_create_deal_on_conversation ON public.conversations;
CREATE TRIGGER auto_create_deal_on_conversation
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_deal_for_new_conversation();


-- ─── 2. Atualiza função do trigger em contacts (fallback de user_id) ─────────

CREATE OR REPLACE FUNCTION public.create_deal_for_new_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_stage_id    UUID;
  v_stage_title TEXT;
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

  INSERT INTO public.deals (contact_id, title, stage, stage_id, priority, user_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.name, NEW.call_name, NEW.phone_number, 'Novo Lead'),
    v_stage_title,
    v_stage_id,
    'medium',
    NEW.user_id
  );

  RETURN NEW;
END;
$function$;
