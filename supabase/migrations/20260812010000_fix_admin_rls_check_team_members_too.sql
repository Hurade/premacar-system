-- ============================================================
-- Corrige checagem de admin nas policies de RLS pra bater com a
-- definição de "admin" que o app já usa em todo lugar (useUserRole:
-- isAdmin = user_roles.role='admin' OU team_members.role='admin').
--
-- A migration 20260731124257 restringiu tabelas de credenciais
-- (whatsapp_connections, nina_settings, integration_settings) e duas
-- policies de escrita (agent_configs, planos_propostas) a
-- has_role(auth.uid(), 'admin'), que só olha user_roles. Um admin
-- cadastrado apenas via Equipe (team_members.role='admin', sem linha
-- em user_roles — o fluxo normal de "adicionar membro") ficava
-- bloqueado nessas tabelas especificamente, mesmo aparecendo como
-- admin em todo o resto do app.
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    public.has_role(_user_id, 'admin')
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = _user_id AND tm.role = 'admin' AND tm.status = 'active'
    )
  )
$$;

DROP POLICY IF EXISTS "Admins can manage whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Admins can manage whatsapp_connections" ON public.whatsapp_connections FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage nina_settings" ON public.nina_settings;
CREATE POLICY "Admins can manage nina_settings" ON public.nina_settings FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage integration_settings" ON public.integration_settings;
CREATE POLICY "Admins can manage integration_settings" ON public.integration_settings FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage agent_configs" ON public.agent_configs;
CREATE POLICY "Admins can manage agent_configs" ON public.agent_configs FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can manage planos" ON public.planos_propostas;
CREATE POLICY "Admins can manage planos" ON public.planos_propostas FOR ALL TO authenticated
  USING (public.is_admin_user(auth.uid())) WITH CHECK (public.is_admin_user(auth.uid()));
