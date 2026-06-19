
DROP POLICY IF EXISTS "Authenticated users can access all appointments" ON public.appointments;
CREATE POLICY "Users manage own appointments" ON public.appointments
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can access all folders" ON public.contact_folders;
CREATE POLICY "Users manage own folders" ON public.contact_folders
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can access all contacts" ON public.contacts;
CREATE POLICY "Users manage own contacts" ON public.contacts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can access all conversations" ON public.conversations;
CREATE POLICY "Users manage own conversations" ON public.conversations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can access all deals" ON public.deals;
CREATE POLICY "Users manage own deals" ON public.deals
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can access all messages" ON public.messages;
CREATE POLICY "Users manage messages in own conversations" ON public.messages
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage send_queue" ON public.send_queue;
CREATE POLICY "Users manage own send_queue" ON public.send_queue
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = send_queue.conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = send_queue.conversation_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage system_logs" ON public.system_logs;
CREATE POLICY "Users read own logs" ON public.system_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage logs" ON public.system_logs
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can manage voice_calls" ON public.voice_calls;
CREATE POLICY "Users manage own voice_calls" ON public.voice_calls
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = voice_calls.contact_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.contacts c WHERE c.id = voice_calls.contact_id AND c.user_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated can read integration_settings" ON public.integration_settings;
CREATE POLICY "Users read own integration_settings" ON public.integration_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read nina_settings" ON public.nina_settings;
CREATE POLICY "Users read own nina_settings" ON public.nina_settings
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Users read own whatsapp_connections" ON public.whatsapp_connections
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read team_members" ON public.team_members;
CREATE POLICY "Users read own team_member or admins" ON public.team_members
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated can read all campaign_contacts" ON public.campaign_contacts;
DROP POLICY IF EXISTS "Authenticated can read all campaign_leads" ON public.campaign_leads;
