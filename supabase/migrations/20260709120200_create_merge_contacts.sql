-- ============================================================
-- Contatos Duplicados: função de merge seguro.
--
-- Reatribui todo o histórico do contato duplicado para o contato
-- principal e remove o duplicado, em uma única transação. Cobre
-- as 8 tabelas que referenciam contacts.id (com ou sem FK formal):
--
--  Sem risco de conflito (contact_id não é único/parte de UNIQUE):
--   appointments, calendar_events, conversations, deals, voice_calls,
--   nina_processing_queue, send_queue, automation_execution_logs
--
--  Com UNIQUE/PK composto envolvendo contact_id — precisa checar
--  conflito antes de mover, senão a UPDATE falha:
--   campaign_contacts        UNIQUE(campaign_id, contact_id)
--   contact_custom_field_values UNIQUE(contact_id, field_id)
--   automation_rule_runs      PK(rule_id, contact_id)
--
-- Regra de conflito: se o contato principal já tem uma linha para
-- a mesma chave (campanha/campo/regra), a versão do principal é
-- mantida e a do duplicado é descartada (last-write-wins a favor
-- de quem já é o "principal" escolhido pelo usuário).
--
-- Dados do próprio contato: tags são unidas (união de arrays);
-- client_memory, notes, etc. do duplicado são descartados —
-- o principal é quem prevalece.
-- ============================================================

CREATE OR REPLACE FUNCTION public.merge_contacts(p_primary_id UUID, p_duplicate_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_primary_id = p_duplicate_id THEN
    RAISE EXCEPTION 'merge_contacts: primary and duplicate contact must differ';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = p_primary_id) THEN
    RAISE EXCEPTION 'merge_contacts: primary contact % not found', p_primary_id;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.contacts WHERE id = p_duplicate_id) THEN
    RAISE EXCEPTION 'merge_contacts: duplicate contact % not found', p_duplicate_id;
  END IF;

  -- Reatribuição direta, sem risco de conflito
  UPDATE public.appointments SET contact_id = p_primary_id WHERE contact_id = p_duplicate_id;
  UPDATE public.calendar_events SET contact_id = p_primary_id WHERE contact_id = p_duplicate_id;
  UPDATE public.conversations SET contact_id = p_primary_id WHERE contact_id = p_duplicate_id;
  UPDATE public.deals SET contact_id = p_primary_id WHERE contact_id = p_duplicate_id;
  UPDATE public.voice_calls SET contact_id = p_primary_id WHERE contact_id = p_duplicate_id;
  UPDATE public.nina_processing_queue SET contact_id = p_primary_id WHERE contact_id = p_duplicate_id;
  UPDATE public.send_queue SET contact_id = p_primary_id WHERE contact_id = p_duplicate_id;
  UPDATE public.automation_execution_logs SET contact_id = p_primary_id WHERE contact_id = p_duplicate_id;

  -- campaign_contacts: UNIQUE(campaign_id, contact_id)
  UPDATE public.campaign_contacts d
  SET contact_id = p_primary_id
  WHERE d.contact_id = p_duplicate_id
    AND NOT EXISTS (
      SELECT 1 FROM public.campaign_contacts p
      WHERE p.contact_id = p_primary_id AND p.campaign_id = d.campaign_id
    );
  DELETE FROM public.campaign_contacts WHERE contact_id = p_duplicate_id;

  -- contact_custom_field_values: UNIQUE(contact_id, field_id)
  UPDATE public.contact_custom_field_values d
  SET contact_id = p_primary_id
  WHERE d.contact_id = p_duplicate_id
    AND NOT EXISTS (
      SELECT 1 FROM public.contact_custom_field_values p
      WHERE p.contact_id = p_primary_id AND p.field_id = d.field_id
    );
  DELETE FROM public.contact_custom_field_values WHERE contact_id = p_duplicate_id;

  -- automation_rule_runs: PK(rule_id, contact_id)
  UPDATE public.automation_rule_runs d
  SET contact_id = p_primary_id
  WHERE d.contact_id = p_duplicate_id
    AND NOT EXISTS (
      SELECT 1 FROM public.automation_rule_runs p
      WHERE p.contact_id = p_primary_id AND p.rule_id = d.rule_id
    );
  DELETE FROM public.automation_rule_runs WHERE contact_id = p_duplicate_id;

  -- União de tags no contato principal
  UPDATE public.contacts
  SET tags = (
        SELECT COALESCE(array_agg(DISTINCT t), ARRAY[]::text[])
        FROM unnest(
          COALESCE((SELECT tags FROM public.contacts WHERE id = p_primary_id), ARRAY[]::text[]) ||
          COALESCE((SELECT tags FROM public.contacts WHERE id = p_duplicate_id), ARRAY[]::text[])
        ) AS t
      ),
      updated_at = now()
  WHERE id = p_primary_id;

  DELETE FROM public.contacts WHERE id = p_duplicate_id;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_contacts(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.merge_contacts(UUID, UUID) TO authenticated;
