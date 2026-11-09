-- API de Comunicação Prema: envio de texto via WhatsApp para donos/equipes
-- de autocenters, por sistemas internos da Prema (sem atendente), saindo
-- pelo número já conectado da Prema. Substitui o endpoint equivalente do
-- Whaticket legado.

-- Dedupe por tipo de evento + janela de tempo (ex: "1 por cliente a cada
-- 24h", "1 por campanha por semana") — automation_rule_runs é dedupe "pra
-- sempre", sem janela, não serve aqui.
CREATE TABLE public.prema_comunicacao_dedupe (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  topico TEXT,
  scope_id TEXT NOT NULL, -- telefone, campaign_id ou network_id, conforme o tipo
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_prema_comunicacao_dedupe_lookup ON public.prema_comunicacao_dedupe(tipo, topico, scope_id, sent_at DESC);

-- Registro de cada envio desta API (sucesso, falha ou bloqueado por dedupe)
-- — auditoria própria, separada do log genérico em system_logs.
CREATE TABLE public.prema_comunicacao_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  topico TEXT,
  phone_number TEXT NOT NULL,
  contact_id UUID REFERENCES public.contacts(id),
  conversation_id UUID REFERENCES public.conversations(id),
  message_id UUID REFERENCES public.messages(id),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'deduped')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prema_comunicacao_dedupe ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prema_comunicacao_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read prema_comunicacao_log"
  ON public.prema_comunicacao_log FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');

GRANT SELECT ON public.prema_comunicacao_log TO authenticated;
GRANT ALL ON public.prema_comunicacao_dedupe TO service_role;
GRANT ALL ON public.prema_comunicacao_log TO service_role;
