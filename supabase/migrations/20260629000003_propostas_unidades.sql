-- Adiciona unidades, fidelidade e extras nas propostas
ALTER TABLE propostas_comerciais
  ADD COLUMN IF NOT EXISTS unidades INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fidelidade_meses INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extras JSONB DEFAULT '[]'::jsonb;
