import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Google JWT auth via Service Account ─────────────────────────────────────

async function getServiceAccountToken(saJson: Record<string, string>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: saJson.client_email,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const b64url = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claim));
  const sigInput = `${header}.${payload}`;

  const pkDer = Uint8Array.from(
    atob(saJson.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')),
    c => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8', pkDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sigBytes = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(sigInput),
  );
  const sig = b64url(String.fromCharCode(...new Uint8Array(sigBytes)));

  const res  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sigInput}.${sig}`,
  });
  const data = await res.json() as Record<string, string>;
  if (!data.access_token) throw new Error(`Google auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ── Calendar config (from integration_settings) ──────────────────────────────

interface CalendarConfig {
  serviceAccountJson: Record<string, string>;
  calendarId: string;
  slotDurationMin: number;   // default 30
  bufferMin: number;         // default 15
  workStart: number;         // hour 0-23, default 9
  workEnd: number;           // hour 0-23, default 18
  timezone: string;          // e.g. 'America/Sao_Paulo'
  daysAhead: number;         // default 7
}

async function loadCalendarConfig(supabase: ReturnType<typeof createClient>, userId: string): Promise<CalendarConfig> {
  const { data, error } = await supabase
    .from('integration_settings')
    .select('google_calendar_service_account_json, google_calendar_id, google_calendar_slot_duration, google_calendar_buffer, google_calendar_work_start, google_calendar_work_end, google_calendar_timezone, google_calendar_days_ahead')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) throw new Error('Configuração do Google Calendar não encontrada. Configure em Configurações → Integrações.');

  const saJson = typeof data.google_calendar_service_account_json === 'string'
    ? JSON.parse(data.google_calendar_service_account_json)
    : data.google_calendar_service_account_json;

  return {
    serviceAccountJson: saJson,
    calendarId:         data.google_calendar_id || 'primary',
    slotDurationMin:    data.google_calendar_slot_duration ?? 30,
    bufferMin:          data.google_calendar_buffer ?? 15,
    workStart:          data.google_calendar_work_start ?? 9,
    workEnd:            data.google_calendar_work_end ?? 18,
    timezone:           data.google_calendar_timezone ?? 'America/Sao_Paulo',
    daysAhead:          data.google_calendar_days_ahead ?? 7,
  };
}

// ── Free slot calculation ────────────────────────────────────────────────────

interface Slot { iso: string; label: string }

function nextWorkdays(count: number, tz: string, workStart: number, workEnd: number): { start: Date; end: Date }[] {
  const days: { start: Date; end: Date }[] = [];
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1); // start from next full hour

  while (days.length < count) {
    const locale = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
    const isSat  = locale === 'Sat';
    const isSun  = locale === 'Sun';

    if (!isSat && !isSun) {
      const dayStart = new Date(d);
      dayStart.setHours(workStart, 0, 0, 0);
      const dayEnd = new Date(d);
      dayEnd.setHours(workEnd, 0, 0, 0);
      days.push({ start: dayStart, end: dayEnd });
    }
    d.setDate(d.getDate() + 1);
    d.setHours(workStart, 0, 0, 0);
  }
  return days;
}

async function getAvailableSlots(
  token: string,
  config: CalendarConfig,
  maxSlots = 5,
): Promise<Slot[]> {
  const days = nextWorkdays(config.daysAhead, config.timezone, config.workStart, config.workEnd);
  const timeMin = days[0].start.toISOString();
  const timeMax = days[days.length - 1].end.toISOString();

  // Fetch existing events
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events`);
  url.searchParams.set('timeMin', timeMin);
  url.searchParams.set('timeMax', timeMax);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json() as { items?: { start: { dateTime?: string }; end: { dateTime?: string } }[] };
  const busy = (data.items ?? [])
    .filter(e => e.start.dateTime && e.end.dateTime)
    .map(e => ({ start: new Date(e.start.dateTime!), end: new Date(e.end.dateTime!) }));

  const slots: Slot[] = [];
  const slotMs  = config.slotDurationMin * 60_000;
  const bufMs   = config.bufferMin * 60_000;
  const now     = Date.now();

  for (const day of days) {
    let cursor = day.start.getTime();
    while (cursor + slotMs <= day.end.getTime() && slots.length < maxSlots) {
      const slotStart = cursor;
      const slotEnd   = cursor + slotMs;

      if (slotStart > now) {
        const conflict = busy.some(b =>
          b.start.getTime() < slotEnd + bufMs &&
          b.end.getTime()   > slotStart - bufMs,
        );
        if (!conflict) {
          const dt = new Date(slotStart);
          const label = new Intl.DateTimeFormat('pt-BR', {
            timeZone: config.timezone,
            weekday: 'short', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit',
          }).format(dt).replace(',', ' —');
          slots.push({ iso: dt.toISOString(), label });
        }
      }
      cursor += slotMs;
    }
    if (slots.length >= maxSlots) break;
  }
  return slots;
}

// ── Create Google Calendar event ─────────────────────────────────────────────

async function createCalendarEvent(
  token: string,
  config: CalendarConfig,
  params: {
    slotIso: string;
    leadName: string;
    leadEmail: string;
    leadCompany: string;
    organizerEmail: string;
  },
): Promise<{ eventId: string; meetLink: string | null }> {
  const start = new Date(params.slotIso);
  const end   = new Date(start.getTime() + config.slotDurationMin * 60_000);

  const body = {
    summary: `Demo PremaCar — ${params.leadName}${params.leadCompany ? ` (${params.leadCompany})` : ''}`,
    description: `Demonstração da plataforma PremaCar.\n\nLead: ${params.leadName}\nEmpresa: ${params.leadCompany ?? '—'}\nWhatsApp: contato via conversa`,
    start: { dateTime: start.toISOString(), timeZone: config.timezone },
    end:   { dateTime: end.toISOString(),   timeZone: config.timezone },
    attendees: [
      { email: params.leadEmail,      displayName: params.leadName },
      { email: params.organizerEmail, displayName: 'PremaCar', organizer: true },
    ],
    conferenceData: {
      createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: 'hangoutsMeet' } },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email', minutes: 60 },
        { method: 'popup', minutes: 15 },
      ],
    },
  };

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(config.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  const event = await res.json() as Record<string, any>;
  if (!event.id) throw new Error(`Erro ao criar evento: ${JSON.stringify(event)}`);

  const meetLink = event.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === 'video')?.uri ?? null;
  return { eventId: event.id, meetLink };
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { action, user_id, ...rest } = await req.json() as Record<string, any>;

    if (!user_id) return new Response(JSON.stringify({ error: 'user_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const config = await loadCalendarConfig(supabase, user_id);
    const token  = await getServiceAccountToken(config.serviceAccountJson);

    // ── available_slots ──────────────────────────────────────────────────────
    if (action === 'available_slots') {
      const slots = await getAvailableSlots(token, config, rest.max_slots ?? 5);
      return new Response(JSON.stringify({ slots }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── create_event ─────────────────────────────────────────────────────────
    if (action === 'create_event') {
      const { slot_iso, lead_name, lead_email, lead_company, conversation_id, contact_id, organizer_email } = rest;

      const { eventId, meetLink } = await createCalendarEvent(token, config, {
        slotIso:        slot_iso,
        leadName:       lead_name,
        leadEmail:      lead_email,
        leadCompany:    lead_company ?? '',
        organizerEmail: organizer_email ?? config.serviceAccountJson.client_email,
      });

      // Persist to calendar_events
      const { data: inserted } = await supabase
        .from('calendar_events')
        .insert({
          conversation_id: conversation_id ?? null,
          contact_id:      contact_id ?? null,
          google_event_id: eventId,
          lead_name,
          lead_email,
          lead_company:    lead_company ?? null,
          scheduled_at:    slot_iso,
          duration_minutes: config.slotDurationMin,
          google_meet_link: meetLink,
        })
        .select('id')
        .single();

      return new Response(JSON.stringify({ success: true, event_id: eventId, meet_link: meetLink, calendar_event_id: inserted?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[google-calendar]', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
