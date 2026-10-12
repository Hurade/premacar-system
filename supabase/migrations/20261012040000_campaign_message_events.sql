-- Um registro por envio de campanha (WhatsApp ou e-mail), pra rastrear o
-- ciclo de vida real da mensagem (enviado → entregue → lido, ou falhou).
-- Antes, o whatsapp_message_id retornado pela Meta/Evolution e o
-- MessageId retornado pelo SES eram só exibidos em console.log e
-- descartados — sem guardar isso em algum lugar, não tinha como o webhook
-- de status (que a Meta/Evolution já mandam) ou o futuro webhook do SES
-- saberem a qual contato/campanha/dia aquela confirmação pertence.
CREATE TABLE public.campaign_message_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.recurring_campaigns(id) ON DELETE CASCADE,
  campaign_contact_id uuid NOT NULL REFERENCES public.campaign_contacts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  day_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  whatsapp_message_id text,
  ses_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_message_events_whatsapp_id ON public.campaign_message_events(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;
CREATE INDEX idx_campaign_message_events_ses_id ON public.campaign_message_events(ses_message_id) WHERE ses_message_id IS NOT NULL;
CREATE INDEX idx_campaign_message_events_campaign ON public.campaign_message_events(campaign_id);

ALTER TABLE public.campaign_message_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view campaign message events"
  ON public.campaign_message_events FOR SELECT
  USING (auth.role() = 'authenticated');

GRANT SELECT ON public.campaign_message_events TO anon, authenticated;
GRANT ALL ON public.campaign_message_events TO service_role;

-- Resumo por campanha+dia+canal, pra montar a tabela detalhada na tela —
-- "bloqueados" vem de campaign_contacts.status='cancelled' (motivo já
-- gravado em metadata.stopped_reason), não desta tabela de eventos.
CREATE OR REPLACE VIEW public.campaign_delivery_breakdown AS
SELECT
  cme.campaign_id,
  cme.day_key,
  cme.channel,
  count(*) AS sent_count,
  count(*) FILTER (WHERE cme.delivered_at IS NOT NULL) AS delivered_count,
  count(*) FILTER (WHERE cme.read_at IS NOT NULL) AS read_count,
  count(*) FILTER (WHERE cme.failed_at IS NOT NULL) AS failed_count,
  count(*) FILTER (WHERE cme.bounced_at IS NOT NULL) AS bounced_count,
  count(*) FILTER (WHERE cme.complained_at IS NOT NULL) AS complained_count
FROM public.campaign_message_events cme
GROUP BY cme.campaign_id, cme.day_key, cme.channel;

GRANT SELECT ON public.campaign_delivery_breakdown TO anon, authenticated;
