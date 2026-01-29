-- Tabela de Modelos de Mensagem
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variations JSONB NOT NULL DEFAULT '[]'::jsonb,
  media_type TEXT DEFAULT 'none', -- 'none', 'image', 'video', 'document', 'audio'
  media_urls JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Campanhas
CREATE TABLE public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed', 'scheduled'
  daily_limit INTEGER NOT NULL DEFAULT 100,
  interval_type TEXT NOT NULL DEFAULT 'random', -- 'fixed', 'random'
  interval_min INTEGER NOT NULL DEFAULT 60, -- seconds
  interval_max INTEGER NOT NULL DEFAULT 180, -- seconds
  business_hours_enabled BOOLEAN NOT NULL DEFAULT true,
  business_hours_start TIME DEFAULT '09:00',
  business_hours_end TIME DEFAULT '18:00',
  business_days INTEGER[] DEFAULT '{1,2,3,4,5}'::integer[],
  anti_ban_enabled BOOLEAN NOT NULL DEFAULT true,
  pause_after_count INTEGER DEFAULT 50,
  pause_duration_minutes INTEGER DEFAULT 15,
  scheduled_start TIMESTAMP WITH TIME ZONE,
  total_leads INTEGER DEFAULT 0,
  sent_today INTEGER DEFAULT 0,
  total_sent INTEGER DEFAULT 0,
  total_delivered INTEGER DEFAULT 0,
  total_read INTEGER DEFAULT 0,
  total_replied INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  paused_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Leads da Campanha
CREATE TABLE public.campaign_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  company TEXT,
  city TEXT,
  product TEXT,
  custom1 TEXT,
  custom2 TEXT,
  custom3 TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'replied', 'error', 'blacklisted'
  variation_used INTEGER,
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  read_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  whatsapp_message_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Blacklist de números
CREATE TABLE public.campaign_blacklist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, phone)
);

-- Índices para performance
CREATE INDEX idx_campaign_leads_campaign_status ON public.campaign_leads(campaign_id, status);
CREATE INDEX idx_campaign_leads_phone ON public.campaign_leads(phone);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_user_id ON public.campaigns(user_id);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_blacklist ENABLE ROW LEVEL SECURITY;

-- RLS Policies para message_templates
CREATE POLICY "Users can manage their own templates"
ON public.message_templates
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies para campaigns
CREATE POLICY "Users can manage their own campaigns"
ON public.campaigns
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies para campaign_leads
CREATE POLICY "Users can manage leads of their campaigns"
ON public.campaign_leads
FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.campaigns 
  WHERE campaigns.id = campaign_leads.campaign_id 
  AND campaigns.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.campaigns 
  WHERE campaigns.id = campaign_leads.campaign_id 
  AND campaigns.user_id = auth.uid()
));

-- RLS Policies para campaign_blacklist
CREATE POLICY "Users can manage their own blacklist"
ON public.campaign_blacklist
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_leads_updated_at
BEFORE UPDATE ON public.campaign_leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para resetar sent_today diariamente
CREATE OR REPLACE FUNCTION public.reset_campaign_daily_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.campaigns 
  SET sent_today = 0, updated_at = now()
  WHERE status IN ('active', 'paused');
END;
$$;