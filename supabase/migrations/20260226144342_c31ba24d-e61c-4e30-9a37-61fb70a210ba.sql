
-- Create recurring_campaigns table
CREATE TABLE public.recurring_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  objective TEXT, -- 'prospecting', 'follow_up', 'reactivation', 'nurture'
  flow_config JSONB NOT NULL DEFAULT '{}',
  status TEXT DEFAULT 'draft', -- 'active', 'paused', 'completed', 'draft'
  total_contacts INTEGER DEFAULT 0,
  in_progress_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  estimated_cost DECIMAL(10,2) DEFAULT 0,
  actual_cost DECIMAL(10,2) DEFAULT 0,
  created_by UUID,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_recurring_campaigns_status ON public.recurring_campaigns(status);
CREATE INDEX idx_recurring_campaigns_created_by ON public.recurring_campaigns(created_by);

-- Enable RLS
ALTER TABLE public.recurring_campaigns ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read all
CREATE POLICY "Authenticated can read all recurring_campaigns"
  ON public.recurring_campaigns FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS: Admins can manage all
CREATE POLICY "Admins can manage all recurring_campaigns"
  ON public.recurring_campaigns FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS: Users can manage own
CREATE POLICY "Users can manage own recurring_campaigns"
  ON public.recurring_campaigns FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create campaign_contacts table
CREATE TABLE public.campaign_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.recurring_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id),
  current_day INTEGER DEFAULT 1,
  status TEXT DEFAULT 'in_progress', -- 'in_progress', 'success', 'failed', 'cancelled', 'paused'
  day_statuses JSONB DEFAULT '{}',
  success_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  failed_reason TEXT,
  metadata JSONB DEFAULT '{}',
  individual_cost DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_campaign_contact UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_campaign_contacts_status ON public.campaign_contacts(status, current_day);
CREATE INDEX idx_campaign_contacts_campaign ON public.campaign_contacts(campaign_id);

-- Enable RLS
ALTER TABLE public.campaign_contacts ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated can read all
CREATE POLICY "Authenticated can read all campaign_contacts"
  ON public.campaign_contacts FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS: Admins can manage all
CREATE POLICY "Admins can manage all campaign_contacts"
  ON public.campaign_contacts FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS: Users can manage contacts of own campaigns
CREATE POLICY "Users can manage contacts of own campaigns"
  ON public.campaign_contacts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.recurring_campaigns
    WHERE recurring_campaigns.id = campaign_contacts.campaign_id
    AND recurring_campaigns.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recurring_campaigns
    WHERE recurring_campaigns.id = campaign_contacts.campaign_id
    AND recurring_campaigns.user_id = auth.uid()
  ));

-- Stats function
CREATE OR REPLACE FUNCTION public.get_recurring_campaign_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'active_campaigns', (
      SELECT COUNT(*) FROM public.recurring_campaigns WHERE status = 'active'
    ),
    'active_contacts', (
      SELECT COUNT(*) FROM public.campaign_contacts WHERE status = 'in_progress'
    ),
    'success_rate', (
      SELECT COALESCE(ROUND(
        (COUNT(*) FILTER (WHERE status = 'success')::DECIMAL / 
         NULLIF(COUNT(*), 0) * 100), 1
      ), 0)
      FROM public.campaign_contacts
    ),
    'total_cost', (
      SELECT COALESCE(SUM(actual_cost), 0) FROM public.recurring_campaigns
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- Trigger for updated_at
CREATE TRIGGER update_recurring_campaigns_updated_at
  BEFORE UPDATE ON public.recurring_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_campaign_contacts_updated_at
  BEFORE UPDATE ON public.campaign_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
