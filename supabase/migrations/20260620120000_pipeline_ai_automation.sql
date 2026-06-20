-- Habilita automação IA no estágio "Fechamento" (posição 3)
-- e atualiza critérios para o contexto específico da Prema
UPDATE pipeline_stages SET
  is_ai_managed = true,
  ai_trigger_criteria = 'Mover quando: lead solicitou proposta/preço/condições de pagamento, demonstrou intenção clara de assinar/contratar, perguntou sobre onboarding ou implementação, ou pediu para falar com alguém para fechar'
WHERE position = 3
  AND is_system = false
  AND is_active = true;

-- Atualiza critérios do estágio "Em Qualificação" (posição 1) para contexto Prema
UPDATE pipeline_stages SET
  ai_trigger_criteria = 'Mover quando: lead respondeu e demonstrou interesse inicial, confirmou ser dono/gestor de oficina ou centro automotivo, mencionou ter base de clientes, ou reconheceu que perde clientes para inatividade'
WHERE position = 1
  AND is_system = false
  AND is_active = true;

-- Atualiza critérios do estágio "Oportunidade" (posição 2) para contexto Prema
UPDATE pipeline_stages SET
  ai_trigger_criteria = 'Mover quando: lead perguntou sobre preço ou planos, pediu demonstração/demo, demonstrou urgência para resolver o problema de clientes inativos, ou mencionou que quer testar/avaliar a plataforma'
WHERE position = 2
  AND is_system = false
  AND is_active = true;

-- Garante que "Novos Leads" (posição 0) não é gerenciado pela IA (é o estágio de entrada)
UPDATE pipeline_stages SET
  is_ai_managed = false
WHERE position = 0
  AND is_system = false;
