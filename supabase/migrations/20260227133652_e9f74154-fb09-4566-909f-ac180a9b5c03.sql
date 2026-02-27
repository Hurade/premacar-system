
-- Integration settings (one per user, not organization since no orgs table exists)
CREATE TABLE public.integration_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Twilio
  twilio_account_sid TEXT,
  twilio_auth_token TEXT,
  twilio_phone_number TEXT,
  twilio_webhook_url TEXT,
  twilio_enabled BOOLEAN DEFAULT false,
  
  -- ElevenLabs (separate from nina_settings for integration-specific config)
  elevenlabs_api_key_integration TEXT,
  elevenlabs_voice_id_integration TEXT DEFAULT 'EXAVITQu4vr4xnSDxMaL',
  elevenlabs_enabled BOOLEAN DEFAULT false,
  
  -- AWS SES
  aws_access_key_id TEXT,
  aws_secret_access_key TEXT,
  aws_region TEXT DEFAULT 'us-east-1',
  aws_ses_email_from TEXT,
  aws_ses_email_from_name TEXT DEFAULT 'PremaCar',
  aws_ses_webhook_url TEXT,
  aws_ses_enabled BOOLEAN DEFAULT false,
  
  -- WhatsApp (reference to existing nina_settings)
  whatsapp_enabled BOOLEAN DEFAULT false,
  
  -- Call settings
  call_script_prompt TEXT,
  call_max_duration INTEGER DEFAULT 180,
  call_hours_start TIME DEFAULT '09:00',
  call_hours_end TIME DEFAULT '18:00',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_integration_settings_user ON public.integration_settings(user_id);

ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage integration_settings"
  ON public.integration_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read integration_settings"
  ON public.integration_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Email templates
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  text_body TEXT,
  variables JSONB DEFAULT '["contact_name", "company_name", "campaign_id"]',
  category TEXT DEFAULT 'campaign',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage email_templates"
  ON public.email_templates FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read email_templates"
  ON public.email_templates FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage own email_templates"
  ON public.email_templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_integration_settings_updated_at
  BEFORE UPDATE ON public.integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_templates_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
