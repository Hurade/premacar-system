
-- appointments
DROP POLICY IF EXISTS "Authenticated users can access all appointments" ON public.appointments;
CREATE POLICY "Users can manage own appointments" ON public.appointments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- campaigns: drop broad read
DROP POLICY IF EXISTS "Authenticated can read all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated can read all recurring_campaigns" ON public.recurring_campaigns;
DROP POLICY IF EXISTS "Authenticated can read all message_templates" ON public.message_templates;

-- contacts
DROP POLICY IF EXISTS "Authenticated users can access all contacts" ON public.contacts;
CREATE POLICY "Users can manage own contacts" ON public.contacts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- conversations
DROP POLICY IF EXISTS "Authenticated users can access all conversations" ON public.conversations;
CREATE POLICY "Users can manage own conversations" ON public.conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- messages (scope via conversations.user_id)
DROP POLICY IF EXISTS "Authenticated users can access all messages" ON public.messages;
CREATE POLICY "Users can manage messages in own conversations" ON public.messages FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()));

-- deals
DROP POLICY IF EXISTS "Authenticated users can access all deals" ON public.deals;
CREATE POLICY "Users can manage own deals" ON public.deals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- email_templates: remove broad read
DROP POLICY IF EXISTS "Authenticated can read email_templates" ON public.email_templates;

-- integration_settings
DROP POLICY IF EXISTS "Authenticated users can manage integration_settings" ON public.integration_settings;
CREATE POLICY "Users can manage own integration_settings" ON public.integration_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- meta_templates: remove broad read
DROP POLICY IF EXISTS "Authenticated can read all meta_templates" ON public.meta_templates;
CREATE POLICY "Users can read their own meta templates" ON public.meta_templates FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- nina_settings
DROP POLICY IF EXISTS "Authenticated users can manage nina_settings" ON public.nina_settings;
CREATE POLICY "Users can manage own nina_settings" ON public.nina_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- pipeline_stages: add user-scoped policy + remove broad read
DROP POLICY IF EXISTS "Authenticated can read pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Users can manage own pipeline_stages" ON public.pipeline_stages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- send_queue (scope via conversations.user_id)
DROP POLICY IF EXISTS "Authenticated users can access send_queue" ON public.send_queue;
CREATE POLICY "Users can manage send_queue for own conversations" ON public.send_queue FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = send_queue.conversation_id AND c.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = send_queue.conversation_id AND c.user_id = auth.uid()));

-- team_members (scope via teams.user_id)
DROP POLICY IF EXISTS "Authenticated users can manage team_members" ON public.team_members;
CREATE POLICY "Team owners can manage team_members" ON public.team_members FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.user_id = auth.uid()) OR team_members.user_id = auth.uid())
WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_members.team_id AND t.user_id = auth.uid()));

-- whatsapp_connections
DROP POLICY IF EXISTS "Authenticated users can manage whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Users can manage own whatsapp_connections" ON public.whatsapp_connections FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- storage call-audios: restrict INSERT to service_role only
DROP POLICY IF EXISTS "Service role can write call audios" ON storage.objects;
CREATE POLICY "Service role can write call audios" ON storage.objects FOR INSERT TO service_role WITH CHECK (bucket_id = 'call-audios');
