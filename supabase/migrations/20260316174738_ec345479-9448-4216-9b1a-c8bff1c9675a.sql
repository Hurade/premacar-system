
-- RECURSO 1: Janela de 24 horas - Adicionar campos na tabela conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS last_customer_message_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS window_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS window_status VARCHAR(20) DEFAULT 'open';

-- RECURSO 2: Múltiplas conexões WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  api_type VARCHAR(20) NOT NULL DEFAULT 'evolution',
  evolution_instance_name VARCHAR(100),
  evolution_api_key TEXT,
  evolution_base_url VARCHAR(255),
  meta_phone_number_id VARCHAR(100),
  meta_access_token TEXT,
  meta_business_account_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  is_connected BOOLEAN DEFAULT false,
  last_connected_at TIMESTAMP WITH TIME ZONE,
  qr_code TEXT,
  qr_code_expires_at TIMESTAMP WITH TIME ZONE,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add connection_id to conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES public.whatsapp_connections(id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_connections_active ON public.whatsapp_connections(is_active);
CREATE INDEX IF NOT EXISTS idx_conversations_connection ON public.conversations(connection_id);
CREATE INDEX IF NOT EXISTS idx_conversations_window ON public.conversations(window_status);

-- RLS for whatsapp_connections
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage whatsapp_connections"
ON public.whatsapp_connections FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read whatsapp_connections"
ON public.whatsapp_connections FOR SELECT
TO authenticated
USING (true);

-- Function to check conversation window status
CREATE OR REPLACE FUNCTION public.check_conversation_window(p_conversation_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conversation RECORD;
BEGIN
  SELECT api_source, window_expires_at, window_status, last_customer_message_at
  INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN json_build_object('can_send_free_message', false, 'window_status', 'not_found', 'requires_template', true);
  END IF;

  -- Se não é Meta API, sempre pode enviar
  IF v_conversation.api_source != 'meta' THEN
    RETURN json_build_object(
      'can_send_free_message', true,
      'window_status', 'open',
      'requires_template', false,
      'expires_at', NULL,
      'hours_remaining', NULL
    );
  END IF;

  -- Se nunca recebeu msg do cliente, janela fechada
  IF v_conversation.last_customer_message_at IS NULL THEN
    RETURN json_build_object(
      'can_send_free_message', false,
      'window_status', 'expired',
      'requires_template', true,
      'expired_at', NULL,
      'hours_since_expired', NULL
    );
  END IF;

  -- Verificar se janela expirou
  IF v_conversation.window_expires_at IS NOT NULL AND v_conversation.window_expires_at < NOW() THEN
    RETURN json_build_object(
      'can_send_free_message', false,
      'window_status', 'expired',
      'requires_template', true,
      'expired_at', v_conversation.window_expires_at,
      'hours_since_expired', EXTRACT(EPOCH FROM (NOW() - v_conversation.window_expires_at)) / 3600
    );
  ELSE
    RETURN json_build_object(
      'can_send_free_message', true,
      'window_status', 'open',
      'requires_template', false,
      'expires_at', v_conversation.window_expires_at,
      'hours_remaining', EXTRACT(EPOCH FROM (v_conversation.window_expires_at - NOW())) / 3600
    );
  END IF;
END;
$$;

-- Trigger function to update window when customer responds
CREATE OR REPLACE FUNCTION public.update_conversation_window()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Apenas quando mensagem é do cliente (from_type = 'user')
  IF NEW.from_type = 'user' THEN
    UPDATE public.conversations
    SET 
      last_customer_message_at = NEW.sent_at,
      window_expires_at = NEW.sent_at + INTERVAL '24 hours',
      window_status = 'open'
    WHERE id = NEW.conversation_id
      AND api_source = 'meta';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on messages table
DROP TRIGGER IF EXISTS trigger_update_conversation_window ON public.messages;
CREATE TRIGGER trigger_update_conversation_window
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_conversation_window();
