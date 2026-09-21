-- Troca o provider de IA padrão do Lovable AI Gateway (Gemini) pro AI
-- Gateway próprio (self-hosted no EasyPanel, backend Groq) — endpoint novo
-- /v1/chat/completions, compatível com o contrato OpenAI que
-- callOpenAICompatible já espera (múltiplas tools, tool_choice "auto",
-- resposta em texto livre). UPDATE em vez de INSERT+repoint pra preservar
-- o mesmo id já referenciado por agent_configs.ai_provider_id em todos os
-- agentes existentes (Atendimento, Comercial, Suporte, CS, Financeiro, RH).
--
-- O gateway não aceita escolher modelo por chamada (sempre usa o
-- GROQ_MODEL configurado nele mesmo) — fast/smart/premium_model viram
-- placeholders, resolveModelAndTemperature ainda escolhe entre eles pela
-- heurística normal, só que o valor escolhido é ignorado pelo gateway.
UPDATE public.ai_providers
SET
  name = 'AI Gateway (self-hosted, Groq)',
  base_url = 'https://ai-gateway-sla.zbvtpx.easypanel.host/v1/chat/completions',
  api_key_secret_name = 'AI_GATEWAY_SECRET',
  fast_model = 'default',
  smart_model = 'default',
  premium_model = 'default'
WHERE is_default = true;
