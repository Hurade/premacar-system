
-- Drop existing restrictive policy on campaigns
DROP POLICY IF EXISTS "Users can manage their own campaigns" ON public.campaigns;

-- Admins can see and manage ALL campaigns
CREATE POLICY "Admins can manage all campaigns"
ON public.campaigns FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Non-admin users can only manage their own campaigns
CREATE POLICY "Users can manage own campaigns"
ON public.campaigns FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Same fix for campaign_leads (depends on campaigns access)
DROP POLICY IF EXISTS "Users can manage leads of their campaigns" ON public.campaign_leads;

CREATE POLICY "Admins can manage all campaign_leads"
ON public.campaign_leads FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage leads of own campaigns"
ON public.campaign_leads FOR ALL
USING (EXISTS (
  SELECT 1 FROM campaigns
  WHERE campaigns.id = campaign_leads.campaign_id
    AND campaigns.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM campaigns
  WHERE campaigns.id = campaign_leads.campaign_id
    AND campaigns.user_id = auth.uid()
));

-- Same fix for message_templates
DROP POLICY IF EXISTS "Users can manage their own templates" ON public.message_templates;

CREATE POLICY "Admins can manage all templates"
ON public.message_templates FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can manage own templates"
ON public.message_templates FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
