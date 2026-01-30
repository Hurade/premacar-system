-- Criar tabela de pastas de contatos
CREATE TABLE public.contact_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Adicionar campos à tabela contacts
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.contact_folders(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS oficina TEXT,
ADD COLUMN IF NOT EXISTS disparo_enabled BOOLEAN DEFAULT false;

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_contacts_folder_id ON public.contacts(folder_id);
CREATE INDEX IF NOT EXISTS idx_contacts_disparo_enabled ON public.contacts(disparo_enabled);
CREATE INDEX IF NOT EXISTS idx_contact_folders_user_id ON public.contact_folders(user_id);

-- Habilitar RLS
ALTER TABLE public.contact_folders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para contact_folders
CREATE POLICY "Authenticated users can access all folders"
ON public.contact_folders
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER update_contact_folders_updated_at
BEFORE UPDATE ON public.contact_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();