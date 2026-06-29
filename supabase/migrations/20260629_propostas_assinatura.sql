-- Adiciona coluna de assinatura do vendedor nas propostas
ALTER TABLE propostas_comerciais
  ADD COLUMN IF NOT EXISTS assinatura_vendedor JSONB;
