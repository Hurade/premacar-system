-- Colunas existentes no banco em produção mas sem migração correspondente
-- (schema drift — adicionadas direto, nunca capturadas em migration).
-- Descobertas ao replicar o schema num projeto novo do zero.
ALTER TABLE public.nina_settings
  ADD COLUMN IF NOT EXISTS scheduling_lunch_break_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduling_lunch_start TIME DEFAULT '12:00:00',
  ADD COLUMN IF NOT EXISTS scheduling_lunch_end TIME DEFAULT '13:30:00',
  ADD COLUMN IF NOT EXISTS scheduling_notify_commercial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS scheduling_notify_phone TEXT,
  ADD COLUMN IF NOT EXISTS scheduling_notify_evolution_instance TEXT;
