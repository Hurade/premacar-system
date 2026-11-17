-- Bug: ao abrir "Nova Conversa" a partir de um contato já existente (que já
-- tem deal), create_deal_for_new_conversation() não cria deal novo (guarda
-- idempotente), mas quando o contato NÃO tem deal ainda, o trigger sempre
-- sorteava um dono por round-robin e sobrescrevia conversations.
-- assigned_user_id com ele — mesmo que o próprio atendente que clicou em
-- "Nova Conversa" devesse ficar com ela. Resultado: a conversa às vezes
-- abria atrelada a outro atendente (o sorteado), não a quem a criou —
-- parecia "rodízio" porque era rodízio mesmo, só que não deveria rodar
-- quando já existe um responsável explícito na hora da criação.
--
-- Fix: o trigger só aplica o round-robin se a conversa não tiver sido
-- criada já com um assigned_user_id explícito (NEW.assigned_user_id). O
-- frontend passa a mandar o atendente atual no INSERT (ver createConversation
-- em useConversations.ts) — quando ele vier preenchido, o trigger respeita;
-- quando vier vazio (webhooks, campanhas, etc.), o round-robin continua
-- valendo como antes.

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
  -- sobrescreveria a atribuição que já deveria valer.
  IF NEW.assigned_user_id IS NULL THEN
    v_owner_id := public.assign_next_owner_round_robin();
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

  -- Propaga a mesma atribuição para a conversa (só quando veio do sorteio —
  -- se já veio explícita no INSERT, NEW.assigned_user_id já é o valor certo).
  IF NEW.assigned_user_id IS NULL AND v_owner_id IS NOT NULL THEN
    UPDATE public.conversations
    SET assigned_user_id = v_owner_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
