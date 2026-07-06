-- ============================================================
-- FASE 0: Reverter RLS restritiva (auth.uid() = user_id) para
-- o modelo permissivo single-tenant (auth.role() = 'authenticated').
--
-- Contexto: a migration 20260629165343_321b5f07-...sql restringiu
-- várias tabelas centrais a "só o dono do registro", reintroduzindo
-- exatamente o problema que 20260619100000_fix_rls_restore_visibility.sql
-- já havia corrigido. Isso bloqueia qualquer fluxo de equipe (ex.: um
-- vendedor sorteado no round-robin não enxergaria o próprio deal, pois
-- deals.user_id normalmente é o usuário "dono" do contato/tenant, não
-- o vendedor atribuído).
--
-- Decisão confirmada com o usuário: este é um sistema single-tenant
-- (uma empresa, vários membros de equipe com login próprio) — não há
-- necessidade de isolar dados por user_id. Restaurar o modelo em que
-- qualquer usuário autenticado acessa tudo.
--
-- Também estendido a campanhas/templates: a mesma migration removeu
-- policies de leitura ampla de campaigns/recurring_campaigns/
-- message_templates/email_templates sem substituí-las, deixando essas
-- tabelas visíveis só para admins ou para o próprio "dono" do registro.
-- Alinhado ao mesmo padrão permissivo por consistência.
-- ============================================================

-- APPOINTMENTS
DROP POLICY IF EXISTS "Users can manage own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can access all appointments" ON public.appointments;
CREATE POLICY "Authenticated users can access all appointments"
ON public.appointments FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- CONTACTS
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can access all contacts" ON public.contacts;
CREATE POLICY "Authenticated users can access all contacts"
ON public.contacts FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- CONVERSATIONS
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can access all conversations" ON public.conversations;
CREATE POLICY "Authenticated users can access all conversations"
ON public.conversations FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- MESSAGES
DROP POLICY IF EXISTS "Users can manage messages in own conversations" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can access all messages" ON public.messages;
CREATE POLICY "Authenticated users can access all messages"
ON public.messages FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- DEALS
DROP POLICY IF EXISTS "Users can manage own deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can access all deals" ON public.deals;
CREATE POLICY "Authenticated users can access all deals"
ON public.deals FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- INTEGRATION_SETTINGS
DROP POLICY IF EXISTS "Users can manage own integration_settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Authenticated users can manage integration_settings" ON public.integration_settings;
CREATE POLICY "Authenticated users can manage integration_settings"
ON public.integration_settings FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- NINA_SETTINGS
DROP POLICY IF EXISTS "Users can manage own nina_settings" ON public.nina_settings;
DROP POLICY IF EXISTS "Authenticated users can manage nina_settings" ON public.nina_settings;
CREATE POLICY "Authenticated users can manage nina_settings"
ON public.nina_settings FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- PIPELINE_STAGES
DROP POLICY IF EXISTS "Users can manage own pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Authenticated users can access pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Authenticated users can access pipeline_stages"
ON public.pipeline_stages FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- SEND_QUEUE
DROP POLICY IF EXISTS "Users can manage send_queue for own conversations" ON public.send_queue;
DROP POLICY IF EXISTS "Authenticated users can access send_queue" ON public.send_queue;
CREATE POLICY "Authenticated users can access send_queue"
ON public.send_queue FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- TEAM_MEMBERS
DROP POLICY IF EXISTS "Team owners can manage team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated users can manage team_members" ON public.team_members;
CREATE POLICY "Authenticated users can manage team_members"
ON public.team_members FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- WHATSAPP_CONNECTIONS
DROP POLICY IF EXISTS "Users can manage own whatsapp_connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Authenticated users can manage whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Authenticated users can manage whatsapp_connections"
ON public.whatsapp_connections FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- META_TEMPLATES (originalmente owner-only em todas as operações;
-- alinhado ao mesmo padrão permissivo dos demais para consistência)
DROP POLICY IF EXISTS "Users can view their own meta templates" ON public.meta_templates;
DROP POLICY IF EXISTS "Users can create their own meta templates" ON public.meta_templates;
DROP POLICY IF EXISTS "Users can update their own meta templates" ON public.meta_templates;
DROP POLICY IF EXISTS "Users can delete their own meta templates" ON public.meta_templates;
DROP POLICY IF EXISTS "Users can read their own meta templates" ON public.meta_templates;
DROP POLICY IF EXISTS "Authenticated can read all meta_templates" ON public.meta_templates;
DROP POLICY IF EXISTS "Authenticated users can manage meta_templates" ON public.meta_templates;
CREATE POLICY "Authenticated users can manage meta_templates"
ON public.meta_templates FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- CAMPAIGNS (a leitura ampla foi removida sem substituição; restava só
-- admin-only e owner-only FOR ALL — estendendo para permissivo)
DROP POLICY IF EXISTS "Admins can manage all campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can manage own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Authenticated users can manage campaigns" ON public.campaigns;
CREATE POLICY "Authenticated users can manage campaigns"
ON public.campaigns FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- RECURRING_CAMPAIGNS
DROP POLICY IF EXISTS "Admins can manage all recurring_campaigns" ON public.recurring_campaigns;
DROP POLICY IF EXISTS "Users can manage own recurring_campaigns" ON public.recurring_campaigns;
DROP POLICY IF EXISTS "Authenticated users can manage recurring_campaigns" ON public.recurring_campaigns;
CREATE POLICY "Authenticated users can manage recurring_campaigns"
ON public.recurring_campaigns FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- MESSAGE_TEMPLATES
DROP POLICY IF EXISTS "Users can manage their own templates" ON public.message_templates;
DROP POLICY IF EXISTS "Authenticated users can manage message_templates" ON public.message_templates;
CREATE POLICY "Authenticated users can manage message_templates"
ON public.message_templates FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- EMAIL_TEMPLATES
DROP POLICY IF EXISTS "Admins can manage email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can manage own email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated can read email_templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can manage email_templates" ON public.email_templates;
CREATE POLICY "Authenticated users can manage email_templates"
ON public.email_templates FOR ALL TO authenticated
USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Nota: a policy de storage.objects para o bucket 'call-audios'
-- (restrita a service_role para INSERT) criada em 20260629165343
-- NÃO é revertida — é uma restrição correta e não relacionada a este bug.

-- ============================================================
-- VERIFICAÇÃO (rodar manualmente após aplicar, logado como um
-- team_member que NÃO seja o usuário admin original, confirmando
-- que contacts/deals/conversations aparecem normalmente)
-- ============================================================
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'appointments','contacts','conversations','messages','deals',
    'integration_settings','nina_settings','pipeline_stages','send_queue',
    'team_members','whatsapp_connections','meta_templates','campaigns',
    'recurring_campaigns','message_templates','email_templates'
  )
ORDER BY tablename, policyname;
