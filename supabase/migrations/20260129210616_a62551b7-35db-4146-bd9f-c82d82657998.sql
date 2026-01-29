-- Add Evolution API columns to nina_settings table
ALTER TABLE public.nina_settings
ADD COLUMN IF NOT EXISTS evolution_api_url text,
ADD COLUMN IF NOT EXISTS evolution_api_key text,
ADD COLUMN IF NOT EXISTS evolution_instance_name text;

-- Add comments for documentation
COMMENT ON COLUMN public.nina_settings.evolution_api_url IS 'URL base da Evolution API (ex: https://evolution.sua-api.com)';
COMMENT ON COLUMN public.nina_settings.evolution_api_key IS 'Chave de autenticação da Evolution API';
COMMENT ON COLUMN public.nina_settings.evolution_instance_name IS 'Nome da instância do WhatsApp conectada';