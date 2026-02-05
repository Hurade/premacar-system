-- Adicionar campos de tags automáticas na tabela campaigns
ALTER TABLE public.campaigns 
  ADD COLUMN IF NOT EXISTS tag_on_delivered TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tag_on_no_whatsapp TEXT DEFAULT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.campaigns.tag_on_delivered IS 'Tag a ser aplicada ao contato quando a mensagem for entregue com sucesso';
COMMENT ON COLUMN public.campaigns.tag_on_no_whatsapp IS 'Tag a ser aplicada ao contato quando o número não possuir WhatsApp';