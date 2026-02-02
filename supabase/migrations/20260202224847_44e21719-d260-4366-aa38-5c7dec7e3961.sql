-- Add api_source column to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN api_source text DEFAULT 'meta' CHECK (api_source IN ('meta', 'evolution'));