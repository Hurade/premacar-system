-- Tabela para armazenar templates aprovados da Meta API
-- Importante: A Meta exige templates pré-aprovados para INICIAR conversas (prospecção)

CREATE TABLE public.meta_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- Nome técnico do template no Meta (ex: prospeccao_premacar_v1)
  display_name VARCHAR(255) NOT NULL, -- Nome amigável para exibir na UI
  category VARCHAR(50) NOT NULL DEFAULT 'MARKETING', -- MARKETING, UTILITY, AUTHENTICATION
  language_code VARCHAR(10) NOT NULL DEFAULT 'pt_BR',
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  header_text TEXT, -- Texto do cabeçalho (opcional)
  body_text TEXT NOT NULL, -- Texto do corpo com {{1}}, {{2}}, etc
  footer_text TEXT, -- Texto do rodapé (opcional)
  parameters_count INTEGER NOT NULL DEFAULT 0, -- Quantidade de variáveis no template
  parameters_mapping JSONB DEFAULT '[]', -- Mapeamento: [{"index": 1, "field": "name"}, {"index": 2, "field": "company"}]
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT meta_templates_name_unique UNIQUE (user_id, name)
);

-- Índices para performance
CREATE INDEX idx_meta_templates_user_id ON public.meta_templates(user_id);
CREATE INDEX idx_meta_templates_status ON public.meta_templates(status);
CREATE INDEX idx_meta_templates_category ON public.meta_templates(category);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_meta_templates_updated_at
  BEFORE UPDATE ON public.meta_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.meta_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own meta templates"
  ON public.meta_templates
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own meta templates"
  ON public.meta_templates
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meta templates"
  ON public.meta_templates
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own meta templates"
  ON public.meta_templates
  FOR DELETE
  USING (auth.uid() = user_id);

-- Adicionar coluna na tabela campaigns para vincular ao meta_template
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS meta_template_id UUID REFERENCES public.meta_templates(id);

-- Adicionar comentário explicativo
COMMENT ON TABLE public.meta_templates IS 'Templates aprovados pela Meta API para envio de mensagens de prospecção. A Meta exige templates pré-aprovados para INICIAR conversas.';