-- Habilitar extensão pg_net para fazer chamadas HTTP do cron
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;