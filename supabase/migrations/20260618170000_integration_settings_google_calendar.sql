-- Add Google Calendar config columns to integration_settings

ALTER TABLE public.integration_settings
  ADD COLUMN IF NOT EXISTS google_calendar_service_account_json JSONB,
  ADD COLUMN IF NOT EXISTS google_calendar_id          TEXT    DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS google_calendar_slot_duration INTEGER DEFAULT 30,
  ADD COLUMN IF NOT EXISTS google_calendar_buffer      INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS google_calendar_work_start  INTEGER DEFAULT 9,
  ADD COLUMN IF NOT EXISTS google_calendar_work_end    INTEGER DEFAULT 18,
  ADD COLUMN IF NOT EXISTS google_calendar_timezone    TEXT    DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS google_calendar_days_ahead  INTEGER DEFAULT 7;
