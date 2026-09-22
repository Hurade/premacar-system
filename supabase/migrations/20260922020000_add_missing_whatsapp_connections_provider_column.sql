-- Coluna existente no banco em produção mas sem migração correspondente
-- (schema drift). Descoberta ao replicar o schema num projeto novo do
-- zero.
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'evolution';
