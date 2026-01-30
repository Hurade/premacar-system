-- Add scheduling availability configuration to nina_settings
ALTER TABLE public.nina_settings
ADD COLUMN IF NOT EXISTS scheduling_available_days integer[] DEFAULT '{1,2,3,4}', -- 0=Sunday, 1=Monday, etc. Default: Mon-Thu
ADD COLUMN IF NOT EXISTS scheduling_start_time time DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS scheduling_end_time time DEFAULT '12:00:00',
ADD COLUMN IF NOT EXISTS scheduling_slot_duration integer DEFAULT 30, -- Duration in minutes
ADD COLUMN IF NOT EXISTS scheduling_buffer_between integer DEFAULT 0, -- Buffer between slots in minutes
ADD COLUMN IF NOT EXISTS google_calendar_url text DEFAULT NULL; -- Optional Google Calendar integration URL

COMMENT ON COLUMN public.nina_settings.scheduling_available_days IS 'Days available for AI scheduling (0=Sunday, 1=Monday, etc.)';
COMMENT ON COLUMN public.nina_settings.scheduling_start_time IS 'Start time for available slots';
COMMENT ON COLUMN public.nina_settings.scheduling_end_time IS 'End time for available slots';
COMMENT ON COLUMN public.nina_settings.scheduling_slot_duration IS 'Duration of each slot in minutes';
COMMENT ON COLUMN public.nina_settings.scheduling_buffer_between IS 'Buffer time between slots in minutes';