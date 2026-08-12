-- Permite desativar o envio automático da pesquisa de satisfação (CSAT)
-- que hoje é disparada sem condição nenhuma ao finalizar um atendimento
-- (useConversations.finalizeConversation → api.sendCsatSurvey).
ALTER TABLE public.nina_settings
ADD COLUMN IF NOT EXISTS csat_survey_enabled BOOLEAN NOT NULL DEFAULT true;
