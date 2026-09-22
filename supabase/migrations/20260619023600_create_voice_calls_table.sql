-- A tabela voice_calls nunca teve uma migração CREATE TABLE — foi criada
-- fora do histórico rastreado (direto no editor), só apareceu depois em
-- migrações que a alteram/referenciam (20260619023648 em diante). Schema
-- reconstruído a partir do projeto em produção (information_schema +
-- pg_constraint + pg_indexes), pra replay funcionar num projeto novo do
-- zero. IF NOT EXISTS em tudo — inofensivo se já existir (ex.: reaplicado
-- por engano no projeto original).
CREATE TABLE IF NOT EXISTS public.voice_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id),
  campaign_id UUID REFERENCES public.recurring_campaigns(id),
  call_sid TEXT UNIQUE,
  status TEXT DEFAULT 'initiated',
  duration_seconds INTEGER,
  dtmf_response TEXT,
  audio_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  call_type TEXT NOT NULL DEFAULT 'campaign' CHECK (call_type IN ('campaign', 'manual')),
  initiated_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_voice_calls_contact_id ON public.voice_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_voice_calls_created_at ON public.voice_calls(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_calls TO authenticated;
GRANT ALL ON public.voice_calls TO service_role;

ALTER TABLE public.voice_calls ENABLE ROW LEVEL SECURITY;
