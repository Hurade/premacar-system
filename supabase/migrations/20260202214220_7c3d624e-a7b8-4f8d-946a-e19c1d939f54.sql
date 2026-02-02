-- Add Meta API columns to nina_settings
ALTER TABLE public.nina_settings 
ADD COLUMN IF NOT EXISTS meta_api_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS meta_phone_number_id TEXT,
ADD COLUMN IF NOT EXISTS meta_access_token TEXT,
ADD COLUMN IF NOT EXISTS meta_business_account_id TEXT,
ADD COLUMN IF NOT EXISTS meta_app_secret TEXT;

-- Add evolution_api_enabled if not exists
ALTER TABLE public.nina_settings 
ADD COLUMN IF NOT EXISTS evolution_api_enabled BOOLEAN DEFAULT true;

-- Add api_source to conversations table
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS api_source TEXT DEFAULT 'evolution';

-- Add api_source to messages table for tracking
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS api_source TEXT DEFAULT 'evolution';

-- Create index on api_source for faster filtering
CREATE INDEX IF NOT EXISTS idx_conversations_api_source ON public.conversations(api_source);

-- Add comment for documentation
COMMENT ON COLUMN public.conversations.api_source IS 'Source API for this conversation: meta or evolution';
COMMENT ON COLUMN public.messages.api_source IS 'Source API for this message: meta or evolution';
COMMENT ON COLUMN public.nina_settings.meta_api_enabled IS 'Whether Meta WhatsApp Business API is enabled';
COMMENT ON COLUMN public.nina_settings.evolution_api_enabled IS 'Whether Evolution API is enabled';