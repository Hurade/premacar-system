-- Botão de resposta rápida (ex: "Não tenho interesse") pro template de
-- WhatsApp — a Meta exige reenvio (edição) do template pra adicionar um
-- botão depois de já ter sido criado sem ele.
ALTER TABLE public.meta_templates
  ADD COLUMN IF NOT EXISTS quick_reply_button TEXT;
