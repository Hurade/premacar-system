-- Add message grouping configuration columns to nina_settings
ALTER TABLE nina_settings 
ADD COLUMN IF NOT EXISTS message_grouping_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS message_grouping_delay INTEGER DEFAULT 20000;

-- Comment: message_grouping_delay is in milliseconds (default 20 seconds)