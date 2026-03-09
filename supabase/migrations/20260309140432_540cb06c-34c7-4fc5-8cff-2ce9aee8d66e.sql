
-- Table to control AI message rate limiting per conversation
CREATE TABLE IF NOT EXISTS public.ai_message_control (
  conversation_id UUID PRIMARY KEY REFERENCES public.conversations(id) ON DELETE CASCADE,
  last_ai_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_ai_content TEXT,
  is_waiting_response BOOLEAN NOT NULL DEFAULT true,
  message_count_last_hour INTEGER NOT NULL DEFAULT 0,
  hour_window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.ai_message_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ai_message_control"
ON public.ai_message_control FOR ALL
TO public
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Function to check if AI can send a message
CREATE OR REPLACE FUNCTION public.can_send_ai_message(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_control RECORD;
  v_time_since_last INTERVAL;
BEGIN
  SELECT * INTO v_control
  FROM public.ai_message_control
  WHERE conversation_id = p_conversation_id;
  
  IF NOT FOUND THEN
    RETURN TRUE;
  END IF;
  
  v_time_since_last := now() - v_control.last_ai_message_at;
  
  -- Block if less than 30 seconds since last AI message
  IF v_time_since_last < INTERVAL '30 seconds' THEN
    RETURN FALSE;
  END IF;
  
  -- Block if waiting for user response
  IF v_control.is_waiting_response = TRUE THEN
    RETURN FALSE;
  END IF;
  
  -- Block if too many messages in last hour (max 15)
  IF v_control.message_count_last_hour > 15 
     AND (now() - v_control.hour_window_start) < INTERVAL '1 hour' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Function to mark AI message as sent
CREATE OR REPLACE FUNCTION public.mark_ai_message_sent(
  p_conversation_id UUID, 
  p_content TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_control RECORD;
BEGIN
  SELECT * INTO v_control
  FROM public.ai_message_control
  WHERE conversation_id = p_conversation_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.ai_message_control (
      conversation_id, last_ai_message_at, last_ai_content, 
      is_waiting_response, message_count_last_hour, hour_window_start
    ) VALUES (
      p_conversation_id, now(), p_content, 
      TRUE, 1, now()
    );
  ELSE
    UPDATE public.ai_message_control
    SET 
      last_ai_message_at = now(),
      last_ai_content = p_content,
      is_waiting_response = TRUE,
      message_count_last_hour = CASE 
        WHEN (now() - hour_window_start) > INTERVAL '1 hour' THEN 1
        ELSE message_count_last_hour + 1
      END,
      hour_window_start = CASE 
        WHEN (now() - hour_window_start) > INTERVAL '1 hour' THEN now()
        ELSE hour_window_start
      END,
      updated_at = now()
    WHERE conversation_id = p_conversation_id;
  END IF;
END;
$$;

-- Function to mark that user responded (unlock AI)
CREATE OR REPLACE FUNCTION public.mark_user_responded(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.ai_message_control
  SET is_waiting_response = FALSE, updated_at = now()
  WHERE conversation_id = p_conversation_id;
END;
$$;

-- Add unique constraint on nina_processing_queue to prevent duplicate processing
CREATE UNIQUE INDEX IF NOT EXISTS idx_nina_queue_unique_pending 
ON public.nina_processing_queue (conversation_id) 
WHERE status IN ('pending', 'processing');
