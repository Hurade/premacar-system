-- Fix 1: Allow all authenticated users to READ campaigns (shared team resource)
CREATE POLICY "Authenticated can read all campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- Fix 2: Allow all authenticated users to READ message_templates
CREATE POLICY "Authenticated can read all message_templates"
  ON public.message_templates FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- Fix 3: Allow all authenticated users to READ meta_templates (not just own)
DROP POLICY IF EXISTS "Users can view their own meta templates" ON public.meta_templates;
CREATE POLICY "Authenticated can read all meta_templates"
  ON public.meta_templates FOR SELECT
  USING (auth.role() = 'authenticated'::text);

-- Fix 4: Allow all authenticated users to READ campaign_leads (to see stats)
CREATE POLICY "Authenticated can read all campaign_leads"
  ON public.campaign_leads FOR SELECT
  USING (auth.role() = 'authenticated'::text);