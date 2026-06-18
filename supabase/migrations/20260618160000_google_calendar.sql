-- Google Calendar integration: calendar_flow state on conversations + events table

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS calendar_flow JSONB;

-- calendar_flow JSONB shape:
-- { "state": "showing_slots" | "slot_selected" | "requesting_email" | "booked",
--   "offered_slots": ["2026-06-19T14:00:00-03:00", ...],
--   "selected_slot": "2026-06-19T14:00:00-03:00",
--   "lead_email": "user@example.com" }

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id   UUID        REFERENCES public.conversations(id) ON DELETE SET NULL,
  contact_id        UUID        REFERENCES public.contacts(id) ON DELETE SET NULL,
  google_event_id   TEXT,
  lead_name         TEXT        NOT NULL,
  lead_email        TEXT        NOT NULL,
  lead_company      TEXT,
  scheduled_at      TIMESTAMPTZ NOT NULL,
  duration_minutes  INTEGER     NOT NULL DEFAULT 30,
  status            TEXT        NOT NULL DEFAULT 'scheduled'
                                CHECK (status IN ('scheduled','completed','cancelled','no_show')),
  google_meet_link  TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage calendar_events"
  ON public.calendar_events FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_calendar_events_org      ON public.calendar_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_conv     ON public.calendar_events(conversation_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_scheduled ON public.calendar_events(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_conversations_calendar_flow
  ON public.conversations USING GIN(calendar_flow)
  WHERE calendar_flow IS NOT NULL;
