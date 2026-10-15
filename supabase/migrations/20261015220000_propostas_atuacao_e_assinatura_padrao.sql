-- Tipo de serviço do lead (pneus/óleo/mecânica geral), pra personalizar a
-- proposta (ex: ciclo de pós-venda do Motor) igual já acontece em
-- Apresentações — mesmos valores de apresentacoes_comerciais.atuacao_principal.
ALTER TABLE public.propostas_comerciais
  ADD COLUMN IF NOT EXISTS atuacao_principal text;

-- Assinatura padrão do vendedor (nome/cargo/telefone/email) — salva uma vez
-- no perfil e é usada automaticamente em toda proposta nova, sem precisar
-- redigitar. Mesmo formato de propostas_comerciais.assinatura_vendedor.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assinatura_padrao jsonb;
