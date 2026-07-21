-- Adiciona campos ausentes na tabela whatsapp_connections:
--   is_default       → marcar uma conexão como padrão para novas conversas
--   meta_app_secret  → assinar verificação de webhook Meta
--   meta_verify_token → token de verificação webhook Meta
--
-- Adiciona connection_id em campaign_contacts para rastrear
-- qual conexão foi usada em cada ação de campanha.

ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS is_default       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS meta_app_secret  TEXT,
  ADD COLUMN IF NOT EXISTS meta_verify_token TEXT;

-- Garante que só uma conexão por organização/user seja default
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_connections_is_default
  ON public.whatsapp_connections (user_id, is_default)
  WHERE is_default = true;

-- FK de ação em campanha → qual conexão executou o envio
ALTER TABLE public.campaign_contacts
  ADD COLUMN IF NOT EXISTS connection_id UUID
    REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_connection_id
  ON public.campaign_contacts (connection_id);
