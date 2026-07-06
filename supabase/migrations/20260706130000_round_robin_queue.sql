-- ============================================================
-- FASE 1.1: Distribuição automática de leads (round-robin ponderado)
--
-- Algoritmo: Smooth Weighted Round Robin (mesmo usado pelo Nginx
-- upstream), usando team_members.weight (já existe, não era usado
-- por nenhuma lógica até agora). Distribui proporcionalmente ao peso
-- sem gerar rajadas (peso 3 não pega 3 leads seguidos).
-- ============================================================

-- Peso não pode ser negativo (hoje só validado na UI, 1-10)
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_weight_non_negative CHECK (weight >= 0);

-- Índices que faltavam para as queries de fila/carga
CREATE INDEX IF NOT EXISTS idx_deals_owner_id ON public.deals(owner_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON public.deals(stage_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON public.team_members(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user_id ON public.conversations(assigned_user_id);

-- Estado persistente do round-robin, 1 linha por team_member ativo
CREATE TABLE IF NOT EXISTS public.round_robin_state (
  team_member_id UUID PRIMARY KEY REFERENCES public.team_members(id) ON DELETE CASCADE,
  current_weight INTEGER NOT NULL DEFAULT 0,
  last_assigned_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.round_robin_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view round_robin_state"
  ON public.round_robin_state FOR SELECT TO authenticated USING (auth.role() = 'authenticated');
-- Sem policy de escrita para 'authenticated': só a function SECURITY DEFINER
-- abaixo (e o service_role) grava aqui, evitando que alguém corrompa o ponteiro.

-- Mantém round_robin_state sincronizado com membros ativos
CREATE OR REPLACE FUNCTION public.sync_round_robin_state()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.round_robin_state (team_member_id, current_weight)
  SELECT id, 0 FROM public.team_members
  WHERE status = 'active'
  ON CONFLICT (team_member_id) DO NOTHING;

  DELETE FROM public.round_robin_state rrs
  WHERE NOT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = rrs.team_member_id AND tm.status = 'active'
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_round_robin_state ON public.team_members;
CREATE TRIGGER trg_sync_round_robin_state
  AFTER INSERT OR UPDATE OF status, weight OR DELETE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.sync_round_robin_state();

-- Função central: escolhe e "consome" o próximo membro do round-robin.
-- Retorna NULL se não houver nenhum team_member ativo (deal fica sem owner).
CREATE OR REPLACE FUNCTION public.assign_next_owner_round_robin()
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_total_weight INTEGER;
  v_chosen_id UUID;
BEGIN
  -- Cobre membros ativos criados antes desta migration
  INSERT INTO public.round_robin_state (team_member_id, current_weight)
  SELECT id, 0 FROM public.team_members WHERE status = 'active'
  ON CONFLICT (team_member_id) DO NOTHING;

  SELECT COALESCE(SUM(tm.weight), 0) INTO v_total_weight
  FROM public.team_members tm
  WHERE tm.status = 'active';

  IF v_total_weight = 0 THEN
    RETURN NULL;
  END IF;

  UPDATE public.round_robin_state rrs
  SET current_weight = rrs.current_weight + tm.weight
  FROM public.team_members tm
  WHERE tm.id = rrs.team_member_id AND tm.status = 'active';

  SELECT rrs.team_member_id INTO v_chosen_id
  FROM public.round_robin_state rrs
  JOIN public.team_members tm ON tm.id = rrs.team_member_id
  WHERE tm.status = 'active'
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

-- Seed inicial para membros já existentes
INSERT INTO public.round_robin_state (team_member_id, current_weight)
SELECT id, 0 FROM public.team_members WHERE status = 'active'
ON CONFLICT (team_member_id) DO NOTHING;
