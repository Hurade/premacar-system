-- ============================================================
-- DIAGNÓSTICO + CORREÇÃO: Restaurar visibilidade dos dados
-- Problema: policies auth.uid() = user_id bloqueando dados
--           com user_id = NULL (sistema single-tenant)
--
-- PASSO 1: Rode o bloco DIAGNÓSTICO primeiro (apenas SELECT)
-- PASSO 2: Se dados existirem com NULL, rode o bloco CORREÇÃO
-- ============================================================


-- ============================================================
-- PASSO 1: DIAGNÓSTICO (só SELECT, sem alterar nada)
-- ============================================================

SELECT
  'contacts'       AS tabela,
  COUNT(*)         AS total_registros,
  COUNT(*) FILTER (WHERE user_id IS NULL)     AS user_id_null,
  COUNT(*) FILTER (WHERE user_id IS NOT NULL) AS user_id_preenchido
FROM public.contacts
UNION ALL
SELECT
  'conversations',  COUNT(*),
  COUNT(*) FILTER (WHERE user_id IS NULL),
  COUNT(*) FILTER (WHERE user_id IS NOT NULL)
FROM public.conversations
UNION ALL
SELECT
  'messages',  COUNT(*),
  0, COUNT(*)  -- messages não tem user_id
FROM public.messages
UNION ALL
SELECT
  'nina_settings',  COUNT(*),
  COUNT(*) FILTER (WHERE user_id IS NULL),
  COUNT(*) FILTER (WHERE user_id IS NOT NULL)
FROM public.nina_settings
UNION ALL
SELECT
  'deals',  COUNT(*),
  COUNT(*) FILTER (WHERE user_id IS NULL),
  COUNT(*) FILTER (WHERE user_id IS NOT NULL)
FROM public.deals
UNION ALL
SELECT
  'appointments',  COUNT(*),
  COUNT(*) FILTER (WHERE user_id IS NULL),
  COUNT(*) FILTER (WHERE user_id IS NOT NULL)
FROM public.appointments;

-- Confirmar usuário admin
SELECT u.id, u.email, u.created_at, r.role
FROM auth.users u
LEFT JOIN public.user_roles r ON r.user_id = u.id
ORDER BY u.created_at;

-- Ver policies ativas agora
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'contacts','conversations','messages','nina_settings',
    'deals','appointments','team_members','integration_settings',
    'whatsapp_connections','send_queue','campaign_contacts','campaign_leads'
  )
ORDER BY tablename, policyname;


-- ============================================================
-- PASSO 2: CORREÇÃO (executar após confirmar diagnóstico)
-- Execute este bloco inteiro de uma vez no SQL Editor
-- ============================================================

BEGIN;

-- --------------------------------------------------------
-- 0. Garantir que o usuário principal tem role 'admin'
--    (insere apenas se não existir)
-- --------------------------------------------------------
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'admin')
ORDER BY created_at
LIMIT 1
ON CONFLICT DO NOTHING;

-- --------------------------------------------------------
-- 1. Backfill user_id com o admin em todos os dados NULL
--    (sistema single-tenant: todos os dados pertencem ao admin)
-- --------------------------------------------------------

WITH admin_user AS (
  SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1
)
UPDATE public.contacts
SET user_id = (SELECT user_id FROM admin_user)
WHERE user_id IS NULL;

WITH admin_user AS (
  SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1
)
UPDATE public.conversations
SET user_id = (SELECT user_id FROM admin_user)
WHERE user_id IS NULL;

WITH admin_user AS (
  SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1
)
UPDATE public.nina_settings
SET user_id = (SELECT user_id FROM admin_user)
WHERE user_id IS NULL;

WITH admin_user AS (
  SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1
)
UPDATE public.deals
SET user_id = (SELECT user_id FROM admin_user)
WHERE user_id IS NULL;

WITH admin_user AS (
  SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1
)
UPDATE public.appointments
SET user_id = (SELECT user_id FROM admin_user)
WHERE user_id IS NULL;

-- --------------------------------------------------------
-- 2. Restaurar policies: sistema single-tenant
--    Política: todo usuário autenticado acessa tudo
--    (não há multi-tenant, sem dados de outros clientes)
-- --------------------------------------------------------

-- CONTACTS
DROP POLICY IF EXISTS "Users can manage own contacts" ON public.contacts;
DROP POLICY IF EXISTS "Authenticated users can access all contacts" ON public.contacts;
CREATE POLICY "Authenticated users can access all contacts"
ON public.contacts FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- CONVERSATIONS
DROP POLICY IF EXISTS "Users can manage own conversations" ON public.conversations;
DROP POLICY IF EXISTS "Authenticated users can access all conversations" ON public.conversations;
CREATE POLICY "Authenticated users can access all conversations"
ON public.conversations FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- MESSAGES
DROP POLICY IF EXISTS "Users can access messages of their conversations" ON public.messages;
DROP POLICY IF EXISTS "Authenticated users can access all messages" ON public.messages;
CREATE POLICY "Authenticated users can access all messages"
ON public.messages FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- NINA_SETTINGS
DROP POLICY IF EXISTS "Users can manage own nina_settings" ON public.nina_settings;
DROP POLICY IF EXISTS "Authenticated can read nina_settings" ON public.nina_settings;
DROP POLICY IF EXISTS "Admins can modify nina_settings" ON public.nina_settings;
CREATE POLICY "Authenticated users can manage nina_settings"
ON public.nina_settings FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- DEALS
DROP POLICY IF EXISTS "Users can manage own deals" ON public.deals;
DROP POLICY IF EXISTS "Authenticated users can access all deals" ON public.deals;
CREATE POLICY "Authenticated users can access all deals"
ON public.deals FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- APPOINTMENTS
DROP POLICY IF EXISTS "Users can manage own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Authenticated users can access all appointments" ON public.appointments;
CREATE POLICY "Authenticated users can access all appointments"
ON public.appointments FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- TEAM_MEMBERS
DROP POLICY IF EXISTS "Users can manage own team_members" ON public.team_members;
DROP POLICY IF EXISTS "Authenticated can read team_members" ON public.team_members;
DROP POLICY IF EXISTS "Admins can modify team_members" ON public.team_members;
CREATE POLICY "Authenticated users can manage team_members"
ON public.team_members FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- INTEGRATION_SETTINGS
DROP POLICY IF EXISTS "Admins can manage integration_settings" ON public.integration_settings;
DROP POLICY IF EXISTS "Authenticated can read integration_settings" ON public.integration_settings;
CREATE POLICY "Authenticated users can manage integration_settings"
ON public.integration_settings FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- WHATSAPP_CONNECTIONS
DROP POLICY IF EXISTS "Admins can manage whatsapp_connections" ON public.whatsapp_connections;
DROP POLICY IF EXISTS "Authenticated can read whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Authenticated users can manage whatsapp_connections"
ON public.whatsapp_connections FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- SEND_QUEUE (Edge Functions precisam acessar sem auth de admin)
DROP POLICY IF EXISTS "Admins can manage send_queue" ON public.send_queue;
DROP POLICY IF EXISTS "Allow all operations on send_queue" ON public.send_queue;
CREATE POLICY "Authenticated users can access send_queue"
ON public.send_queue FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- PIPELINE_STAGES (global, leitura para todos)
DROP POLICY IF EXISTS "Users can manage own pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Authenticated can read pipeline_stages" ON public.pipeline_stages;
DROP POLICY IF EXISTS "Admins can modify pipeline_stages" ON public.pipeline_stages;
CREATE POLICY "Authenticated users can access pipeline_stages"
ON public.pipeline_stages FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- TAG_DEFINITIONS (global)
DROP POLICY IF EXISTS "Users can manage own tag_definitions" ON public.tag_definitions;
DROP POLICY IF EXISTS "Authenticated can read tag_definitions" ON public.tag_definitions;
DROP POLICY IF EXISTS "Admins can modify tag_definitions" ON public.tag_definitions;
CREATE POLICY "Authenticated users can access tag_definitions"
ON public.tag_definitions FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

COMMIT;

-- --------------------------------------------------------
-- VERIFICAÇÃO FINAL (rode após o COMMIT)
-- --------------------------------------------------------
SELECT
  'contacts'    AS tabela, COUNT(*) AS total_agora_visivel
FROM public.contacts
UNION ALL
SELECT 'conversations', COUNT(*) FROM public.conversations
UNION ALL
SELECT 'messages', COUNT(*) FROM public.messages
UNION ALL
SELECT 'nina_settings', COUNT(*) FROM public.nina_settings;
