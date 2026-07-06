-- ============================================================
-- FASE 2.3: Campos personalizados por contato
--
-- Não usa `contacts.client_memory` (schema fixo de IA, com semântica própria
-- de lead_profile/sales_intelligence — usado pela Cris via RPC
-- update_client_memory). Schema novo e separado para campos livres definidos
-- pelo usuário.
-- ============================================================

CREATE TYPE public.custom_field_type AS ENUM ('texto', 'numero', 'data', 'select');

CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  chave TEXT NOT NULL UNIQUE,
  tipo public.custom_field_type NOT NULL DEFAULT 'texto',
  opcoes JSONB NOT NULL DEFAULT '[]'::jsonb, -- só relevante quando tipo = 'select'
  obrigatorio BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  value TEXT, -- sempre texto; parse/formatação conforme "tipo" no frontend
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_ccfv_contact_id ON public.contact_custom_field_values(contact_id);
CREATE INDEX IF NOT EXISTS idx_ccfv_field_id ON public.contact_custom_field_values(field_id);
CREATE INDEX IF NOT EXISTS idx_cfd_ativo ON public.custom_field_definitions(ativo);

CREATE TRIGGER update_custom_field_definitions_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_contact_custom_field_values_updated_at
  BEFORE UPDATE ON public.contact_custom_field_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage custom_field_definitions"
  ON public.custom_field_definitions FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage contact_custom_field_values"
  ON public.contact_custom_field_values FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
