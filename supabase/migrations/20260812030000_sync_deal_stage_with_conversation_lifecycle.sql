-- ============================================================
-- "Novos Leads" deve conter só conversas intocadas: ainda com a Cris
-- (status='nina') e ainda ativas. Duas regras novas, aplicadas via
-- trigger em conversations (cobre qualquer código que mude o status:
-- app, webhook, orchestrator):
--
-- Regra A — status saiu de 'nina' (assumida manualmente ou
-- transferida pela IA/transfer_to_human) e o deal do contato ainda
-- está em "Novos Leads" → avança pro próximo estágio do pipeline,
-- porque deixou de ser um lead intocado.
--
-- Regra B — atendimento finalizado (is_active true→false, via
-- finalizeConversation) enquanto o deal ainda está em "Novos Leads"
-- → remove o card do pipeline (não virou lead real). Se a Regra A já
-- tiver avançado o deal antes (ex: nina→human→paused em updates
-- separados), o deal já não está mais em Novos Leads e não é
-- removido — só avança quando finalizado depois de atendido.
--
-- Quando as duas condições batem no mesmo UPDATE (ex: finalizar uma
-- conversa ainda em 'nina', que muda status e is_active na mesma
-- chamada), a Regra B tem prioridade: o card é removido, não avançado.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_deal_stage_on_conversation_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deal_id       UUID;
  v_deal_stage_id UUID;
  v_stage_title   TEXT;
  v_stage_position INTEGER;
  v_stage_user_id UUID;
  v_next_stage_id UUID;
  v_next_stage_title TEXT;
BEGIN
  IF NEW.contact_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
    RETURN NEW;
  END IF;

  SELECT id, stage_id INTO v_deal_id, v_deal_stage_id
  FROM public.deals
  WHERE contact_id = NEW.contact_id
  LIMIT 1;

  IF v_deal_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title, position, user_id INTO v_stage_title, v_stage_position, v_stage_user_id
  FROM public.pipeline_stages
  WHERE id = v_deal_stage_id;

  -- Deal não está (mais) em "Novos Leads" -> nada a fazer aqui
  IF v_stage_title IS DISTINCT FROM 'Novos Leads' THEN
    RETURN NEW;
  END IF;

  -- Regra B (prioridade): finalizado enquanto ainda em Novos Leads
  IF NEW.is_active = false AND OLD.is_active = true THEN
    DELETE FROM public.deals WHERE id = v_deal_id;
    RETURN NEW;
  END IF;

  -- Regra A: saiu do status inicial 'nina'
  IF OLD.status = 'nina' AND NEW.status IS DISTINCT FROM 'nina' THEN
    SELECT id, title INTO v_next_stage_id, v_next_stage_title
    FROM public.pipeline_stages
    WHERE is_active = true
      AND position > v_stage_position
      AND (user_id = v_stage_user_id OR (v_stage_user_id IS NULL AND user_id IS NULL))
    ORDER BY position
    LIMIT 1;

    IF v_next_stage_id IS NOT NULL THEN
      UPDATE public.deals
      SET stage_id = v_next_stage_id, stage = v_next_stage_title
      WHERE id = v_deal_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_deal_stage_on_conversation_lifecycle ON public.conversations;
CREATE TRIGGER trg_sync_deal_stage_on_conversation_lifecycle
AFTER UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.sync_deal_stage_on_conversation_lifecycle();
