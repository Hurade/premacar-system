-- ============================================================
-- Unifica os dois sistemas de configuração de agente de IA:
--   nina_settings (linha única global) + agent_configs (múltiplas,
--   roteadas por trigger_type) num só: agent_configs.
--
-- Motivo: origem/campanha nunca funcionavam de fato (conversations
-- não tinha `origin`/`campaign_id`, então a seleção sempre caía no
-- fallback). Substitui por um roteamento que realmente existe:
-- Campanha (recurring_campaigns, agora rastreada em conversations)
-- > Fila (queues, já usada no chat) > Padrão.
-- ============================================================

-- Normaliza gatilhos que deixam de existir (origem nunca casava de
-- verdade; evento nunca teve lógica de seleção nenhuma)
UPDATE public.agent_configs SET trigger_type = 'default', trigger_origin = NULL, trigger_event = NULL
WHERE trigger_type IN ('origin', 'event');

-- A normalização acima pode ter juntado várias linhas em
-- trigger_type='default' (ex.: já existia "Cris SDR — Padrão" e
-- também agentes antigos por origem). Zera a prioridade de todas
-- (a ordenação por prioridade nunca deve fingir preferir uma) e
-- mantém ativa só a mais antiga (preferindo uma que já estivesse
-- ativa) como único fallback real — as demais ficam inativas, mas
-- continuam visíveis em "Agentes de IA" para o usuário excluir ou
-- reatribuir a uma fila/campanha.
UPDATE public.agent_configs SET priority = 0 WHERE trigger_type = 'default';

UPDATE public.agent_configs ac
SET is_active = false
WHERE ac.trigger_type = 'default'
  AND ac.id <> (
    SELECT id FROM public.agent_configs
    WHERE trigger_type = 'default'
    ORDER BY is_active DESC, created_at ASC
    LIMIT 1
  );

-- FK de campanha apontava para o sistema antigo de disparo único
-- (`campaigns`), não para `recurring_campaigns` (o sistema atual,
-- usado por Campanhas.tsx) — por isso nunca casava. Repontar.
ALTER TABLE public.agent_configs DROP CONSTRAINT IF EXISTS agent_configs_trigger_campaign_id_fkey;
UPDATE public.agent_configs SET trigger_campaign_id = NULL; -- valores existentes eram órfãos/inertes

ALTER TABLE public.agent_configs
  ADD COLUMN trigger_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL,
  ADD CONSTRAINT agent_configs_trigger_campaign_id_fkey
    FOREIGN KEY (trigger_campaign_id) REFERENCES public.recurring_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.agent_configs DROP COLUMN trigger_origin, DROP COLUMN trigger_event;

-- Colunas configuráveis na UI mas nunca lidas por nenhuma edge
-- function (handoff por palavra-chave e rate-limit nunca foram
-- implementados de fato) — removendo em vez de deixar como
-- promessa vazia na tela.
ALTER TABLE public.agent_configs
  DROP COLUMN handoff_keywords,
  DROP COLUMN handoff_message,
  DROP COLUMN max_messages_per_hour,
  DROP COLUMN response_delay_seconds;

ALTER TABLE public.agent_configs DROP CONSTRAINT IF EXISTS agent_configs_trigger_type_check;
ALTER TABLE public.agent_configs ADD CONSTRAINT agent_configs_trigger_type_check
  CHECK (trigger_type IN ('default', 'queue', 'campaign'));

CREATE INDEX idx_agent_configs_trigger_queue_id ON public.agent_configs(trigger_queue_id);

-- Garante que sempre existe 1 agente Padrão, semeado do nina_settings
-- se agent_configs ainda não tiver nenhum (primeira aplicação desta migration)
INSERT INTO public.agent_configs (name, description, icon, trigger_type, system_prompt, model_mode,
                                   message_breaking_enabled, ai_activation_delay_minutes, is_active, priority)
SELECT 'Agente Padrão', 'Usado quando nenhuma fila ou campanha específica casar com a conversa.', '🤖',
       'default', COALESCE(ns.system_prompt_override, 'Você é um assistente de atendimento. Seja educado e objetivo.'),
       COALESCE(ns.ai_model_mode, 'flash'), COALESCE(ns.message_breaking_enabled, true),
       COALESCE(ns.ai_activation_delay_minutes, 5), true, 0
FROM public.nina_settings ns
WHERE NOT EXISTS (SELECT 1 FROM public.agent_configs WHERE trigger_type = 'default')
LIMIT 1;

-- nina_settings deixa de ter esses 4 campos: totalmente superados
-- pela linha "Padrão" em agent_configs (fonte única de verdade agora)
ALTER TABLE public.nina_settings
  DROP COLUMN IF EXISTS system_prompt_override,
  DROP COLUMN IF EXISTS ai_model_mode,
  DROP COLUMN IF EXISTS message_breaking_enabled,
  DROP COLUMN IF EXISTS ai_activation_delay_minutes;

-- Roteamento real de campanha em conversas novas (gravado pelo
-- webhook de resposta no momento da criação da conversa)
ALTER TABLE public.conversations
  ADD COLUMN campaign_id UUID REFERENCES public.recurring_campaigns(id) ON DELETE SET NULL;
CREATE INDEX idx_conversations_campaign_id ON public.conversations(campaign_id);

-- Fila padrão por conexão WhatsApp — ex: um número dedicado de
-- Suporte já nasce com a conversa na fila Suporte, sem precisar de
-- atribuição manual antes do agente especializado poder responder.
ALTER TABLE public.whatsapp_connections
  ADD COLUMN default_queue_id UUID REFERENCES public.queues(id) ON DELETE SET NULL;
