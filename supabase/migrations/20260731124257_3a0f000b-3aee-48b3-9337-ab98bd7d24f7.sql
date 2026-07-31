CREATE OR REPLACE FUNCTION public.is_active_team_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.user_id = _user_id AND tm.status = 'active')
    OR public.has_role(_user_id, 'admin')
  )
$$;

-- Shared operational tables: active team members only
DROP POLICY IF EXISTS "Authenticated users can access all appointments" ON public.appointments;
CREATE POLICY "Team members can access appointments" ON public.appointments FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage campaigns" ON public.campaigns;
CREATE POLICY "Team members can manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can access all contacts" ON public.contacts;
CREATE POLICY "Team members can access contacts" ON public.contacts FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can access all conversations" ON public.conversations;
CREATE POLICY "Team members can access conversations" ON public.conversations FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can access all deals" ON public.deals;
CREATE POLICY "Team members can access deals" ON public.deals FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage email_templates" ON public.email_templates;
CREATE POLICY "Team members can manage email_templates" ON public.email_templates FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage meta_templates" ON public.meta_templates;
CREATE POLICY "Team members can manage meta_templates" ON public.meta_templates FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage message_templates" ON public.message_templates;
CREATE POLICY "Team members can read message_templates" ON public.message_templates FOR SELECT TO authenticated
  USING (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can access all messages" ON public.messages;
CREATE POLICY "Team members can access messages" ON public.messages FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can access send_queue" ON public.send_queue;
CREATE POLICY "Team members can access send_queue" ON public.send_queue FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can access all voice_calls" ON public.voice_calls;
CREATE POLICY "Team members can access voice_calls" ON public.voice_calls FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "leads_all" ON public.leads_comerciais;
CREATE POLICY "Team members can manage leads_comerciais" ON public.leads_comerciais FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can manage agent_configs" ON public.agent_configs;
DROP POLICY IF EXISTS "Authenticated users can read agent_configs" ON public.agent_configs;
CREATE POLICY "Team members can read agent_configs" ON public.agent_configs FOR SELECT TO authenticated
  USING (public.is_active_team_member(auth.uid()));
CREATE POLICY "Admins can manage agent_configs" ON public.agent_configs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "planos_select" ON public.planos_propostas;
DROP POLICY IF EXISTS "planos_write" ON public.planos_propostas;
CREATE POLICY "Team members can read planos" ON public.planos_propostas FOR SELECT TO authenticated
  USING (public.is_active_team_member(auth.uid()));
CREATE POLICY "Admins can manage planos" ON public.planos_propostas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "historico_all" ON public.propostas_historico;
CREATE POLICY "Team members can access propostas_historico" ON public.propostas_historico FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

-- Credential-bearing tables: admins only
DROP POLICY IF EXISTS "Authenticated users can manage integration_settings" ON public.integration_settings;
CREATE POLICY "Admins can manage integration_settings" ON public.integration_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can manage nina_settings" ON public.nina_settings;
CREATE POLICY "Admins can manage nina_settings" ON public.nina_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can manage whatsapp_connections" ON public.whatsapp_connections;
CREATE POLICY "Admins can manage whatsapp_connections" ON public.whatsapp_connections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Proposals: no more open anon table access; slug-scoped functions instead
DROP POLICY IF EXISTS "propostas_all" ON public.propostas_comerciais;
DROP POLICY IF EXISTS "propostas_public" ON public.propostas_comerciais;
CREATE POLICY "Team members can manage propostas" ON public.propostas_comerciais FOR ALL TO authenticated
  USING (public.is_active_team_member(auth.uid())) WITH CHECK (public.is_active_team_member(auth.uid()));

REVOKE SELECT ON public.propostas_comerciais FROM anon;
REVOKE SELECT ON public.leads_comerciais FROM anon;
REVOKE SELECT ON public.planos_propostas FROM anon;

CREATE OR REPLACE FUNCTION public.get_proposta_publica(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT to_jsonb(x) FROM (
    SELECT p.id, p.status, p.diagnostico, p.valor_mensal, p.desconto_percentual,
           p.condicao_especial, p.validade_dias, p.validade_ate, p.slug,
           p.motivo_recusa, p.unidades, p.fidelidade_meses, p.extras,
           p.assinatura_vendedor, p.created_at, p.plano_id, p.lead_id,
           (SELECT to_jsonb(l2) FROM (
              SELECT l.id, l.empresa, l.responsavel, l.cidade, l.estado,
                     l.tipo_negocio, l.clientes_mes, l.clientes_base, l.erp_utilizado, l.dor_principal
              FROM public.leads_comerciais l WHERE l.id = p.lead_id
           ) l2) AS lead,
           (SELECT to_jsonb(pl) FROM public.planos_propostas pl WHERE pl.id = p.plano_id) AS plano
    FROM public.propostas_comerciais p
    WHERE p.slug = p_slug AND p.status <> 'rascunho'
  ) x
$$;

CREATE OR REPLACE FUNCTION public.atualizar_status_proposta_publica(p_slug text, p_status text, p_motivo text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  IF p_status NOT IN ('visualizada', 'aceita', 'recusada') THEN
    RAISE EXCEPTION 'status inválido';
  END IF;

  UPDATE public.propostas_comerciais
  SET status = p_status,
      visualizada_at = CASE WHEN p_status = 'visualizada' THEN now() ELSE visualizada_at END,
      aceita_at      = CASE WHEN p_status = 'aceita' THEN now() ELSE aceita_at END,
      recusada_at    = CASE WHEN p_status = 'recusada' THEN now() ELSE recusada_at END,
      motivo_recusa  = CASE WHEN p_status = 'recusada' THEN p_motivo ELSE motivo_recusa END,
      updated_at = now()
  WHERE slug = p_slug
    AND status NOT IN ('rascunho', 'aceita', 'recusada', 'expirada')
    AND (p_status <> 'visualizada' OR status = 'enviada');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_proposta_publica(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_status_proposta_publica(text, text, text) TO anon, authenticated;

-- Fixed search_path on remaining functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.set_conversation_protocol_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.protocol_number IS NULL THEN
    NEW.protocol_number := to_char(NEW.created_at, 'YYYYMMDD') || '-' ||
      lpad(nextval('public.conversation_protocol_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.match_documents(query_embedding extensions.vector, match_threshold double precision DEFAULT 0.72, match_count integer DEFAULT 4, p_queue_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(id uuid, document_id uuid, content text, similarity double precision)
LANGUAGE sql STABLE SET search_path = public, extensions AS $$
  SELECT kc.id, kc.document_id, kc.content,
         1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kd.status = 'ready'
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    AND (
      (p_queue_id IS NULL AND kd.queue_id IS NULL)
      OR (p_queue_id IS NOT NULL AND (kd.queue_id = p_queue_id OR kd.queue_id IS NULL))
    )
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;