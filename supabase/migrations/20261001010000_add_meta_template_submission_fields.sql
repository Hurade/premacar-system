-- Até aqui, "Novo Template Meta" só cadastrava um espelho local do que já
-- tinha sido criado manualmente no Meta Business Suite — nada no sistema
-- de fato enviava o template para aprovação da Meta. Esses campos guardam
-- o ID que a Meta atribui ao template (confirma que o envio aconteceu) e o
-- erro de envio, se a Meta recusar de cara (nome duplicado, categoria
-- inválida, etc. — distinto de rejected_reason, que é a rejeição vinda da
-- revisão humana da Meta, dias depois).
ALTER TABLE public.meta_templates
  ADD COLUMN IF NOT EXISTS meta_template_id TEXT,
  ADD COLUMN IF NOT EXISTS submission_error TEXT;
