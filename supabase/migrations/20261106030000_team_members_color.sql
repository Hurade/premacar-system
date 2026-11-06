-- Cor de identificação por membro da equipe (usada no badge de "atribuído a"
-- nas conversas) — antes era sempre ciano fixo pra todo mundo, sem distinguir
-- visualmente quem está com cada conversa.
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS color TEXT;
