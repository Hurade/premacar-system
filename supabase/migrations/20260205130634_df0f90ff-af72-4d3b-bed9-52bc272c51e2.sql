-- Adicionar campo de delay de ativação da IA em nina_settings
ALTER TABLE nina_settings 
ADD COLUMN IF NOT EXISTS ai_activation_delay_minutes INTEGER DEFAULT 5;

-- Adicionar campo dispatch_sent_at em conversations para rastrear quando o disparo foi enviado
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS dispatch_sent_at TIMESTAMP WITH TIME ZONE;

-- Criar índice para buscar conversas com dispatch pendente
CREATE INDEX IF NOT EXISTS idx_conversations_dispatch_sent_at 
ON conversations(dispatch_sent_at) 
WHERE dispatch_sent_at IS NOT NULL;

-- Comentários explicativos
COMMENT ON COLUMN nina_settings.ai_activation_delay_minutes IS 'Tempo em minutos que a IA aguarda antes de responder após um disparo. 0 = sem delay.';
COMMENT ON COLUMN conversations.dispatch_sent_at IS 'Timestamp de quando o disparo foi enviado. NULL = conversa inbound (não é disparo).';