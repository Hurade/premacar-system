-- Bug: usuários não-admin não conseguiam escolher conexão ao iniciar uma
-- nova conversa (ChatInterface.tsx faz supabase.from('whatsapp_connections')
-- direto, sem edge function). A única RLS policy da tabela hoje é
-- "Admins can manage whatsapp_connections" (FOR ALL, só admin) — como é
-- FOR ALL, cobre SELECT também, então não-admin não satisfaz nenhuma
-- policy e recebe 0 linhas silenciosamente (RLS não retorna erro).
--
-- Fix: policy de SELECT separada para membros de equipe ativos (mesma
-- função is_active_team_member já usada em outras tabelas, ex.
-- apresentacoes_templates em 20260803_apresentacoes.sql). A policy de
-- gestão (INSERT/UPDATE/DELETE) continua restrita a admin.

CREATE POLICY "Team members can read whatsapp_connections"
  ON public.whatsapp_connections FOR SELECT TO authenticated
  USING (public.is_active_team_member(auth.uid()));
