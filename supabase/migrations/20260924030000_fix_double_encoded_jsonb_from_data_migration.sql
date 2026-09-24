-- Bug crítico da migração de dados (22/09/2026, migrate-data-to-new-project):
-- o script de cópia fazia JSON.stringify() nos valores de colunas JSONB antes
-- de inserir via postgres.js — mas postgres.js já serializa automaticamente
-- valores JS pra colunas jsonb, então o resultado ficou com DUPLA
-- codificação: em vez de um objeto/array JSON de verdade, a coluna passou a
-- guardar uma STRING cujo conteúdo é o texto do JSON original
-- (jsonb_typeof = 'string' em vez de 'object'/'array').
--
-- Isso ficou invisível até agora porque nada tinha tentado LER esses campos
-- como objeto ainda (ex.: o chat quebrando com tela preta ao abrir uma
-- conversa, por causa de contacts.client_memory).
--
-- Fix: para cada linha afetada, "desembrulha" a string pra extrair o texto
-- cru (#>> '{}', sem re-escapar) e reinterpreta como jsonb de verdade.
-- Só toca linhas com jsonb_typeof = 'string' — linhas já corretas (objetos/
-- arrays reais, incluindo tudo criado depois do cutover) não são afetadas.

UPDATE public.contacts SET client_memory = (client_memory #>> '{}')::jsonb
  WHERE jsonb_typeof(client_memory) = 'string';

UPDATE public.messages SET metadata = (metadata #>> '{}')::jsonb
  WHERE jsonb_typeof(metadata) = 'string';

UPDATE public.conversations SET
  metadata = CASE WHEN jsonb_typeof(metadata) = 'string' THEN (metadata #>> '{}')::jsonb ELSE metadata END,
  nina_context = CASE WHEN jsonb_typeof(nina_context) = 'string' THEN (nina_context #>> '{}')::jsonb ELSE nina_context END,
  calendar_flow = CASE WHEN jsonb_typeof(calendar_flow) = 'string' THEN (calendar_flow #>> '{}')::jsonb ELSE calendar_flow END
  WHERE jsonb_typeof(metadata) = 'string' OR jsonb_typeof(nina_context) = 'string' OR jsonb_typeof(calendar_flow) = 'string';

UPDATE public.send_queue SET metadata = (metadata #>> '{}')::jsonb
  WHERE jsonb_typeof(metadata) = 'string';

UPDATE public.system_logs SET metadata = (metadata #>> '{}')::jsonb
  WHERE jsonb_typeof(metadata) = 'string';

UPDATE public.user_action_logs SET metadata = (metadata #>> '{}')::jsonb
  WHERE jsonb_typeof(metadata) = 'string';

UPDATE public.appointments SET metadata = (metadata #>> '{}')::jsonb
  WHERE jsonb_typeof(metadata) = 'string';

UPDATE public.apresentacoes_comerciais SET assinatura_vendedor = (assinatura_vendedor #>> '{}')::jsonb
  WHERE jsonb_typeof(assinatura_vendedor) = 'string';

UPDATE public.automation_rules SET
  actions = CASE WHEN jsonb_typeof(actions) = 'string' THEN (actions #>> '{}')::jsonb ELSE actions END,
  conditions = CASE WHEN jsonb_typeof(conditions) = 'string' THEN (conditions #>> '{}')::jsonb ELSE conditions END,
  trigger_config = CASE WHEN jsonb_typeof(trigger_config) = 'string' THEN (trigger_config #>> '{}')::jsonb ELSE trigger_config END
  WHERE jsonb_typeof(actions) = 'string' OR jsonb_typeof(conditions) = 'string' OR jsonb_typeof(trigger_config) = 'string';

UPDATE public.integration_settings SET google_calendar_service_account_json = (google_calendar_service_account_json #>> '{}')::jsonb
  WHERE jsonb_typeof(google_calendar_service_account_json) = 'string';

UPDATE public.knowledge_chunks SET metadata = (metadata #>> '{}')::jsonb
  WHERE jsonb_typeof(metadata) = 'string';

UPDATE public.message_grouping_queue SET
  contacts_data = CASE WHEN jsonb_typeof(contacts_data) = 'string' THEN (contacts_data #>> '{}')::jsonb ELSE contacts_data END,
  message_data = CASE WHEN jsonb_typeof(message_data) = 'string' THEN (message_data #>> '{}')::jsonb ELSE message_data END
  WHERE jsonb_typeof(contacts_data) = 'string' OR jsonb_typeof(message_data) = 'string';

UPDATE public.message_templates SET
  media_urls = CASE WHEN jsonb_typeof(media_urls) = 'string' THEN (media_urls #>> '{}')::jsonb ELSE media_urls END,
  variations = CASE WHEN jsonb_typeof(variations) = 'string' THEN (variations #>> '{}')::jsonb ELSE variations END
  WHERE jsonb_typeof(media_urls) = 'string' OR jsonb_typeof(variations) = 'string';

UPDATE public.meta_templates SET parameters_mapping = (parameters_mapping #>> '{}')::jsonb
  WHERE jsonb_typeof(parameters_mapping) = 'string';

UPDATE public.nina_processing_queue SET context_data = (context_data #>> '{}')::jsonb
  WHERE jsonb_typeof(context_data) = 'string';

UPDATE public.planos_propostas SET recursos = (recursos #>> '{}')::jsonb
  WHERE jsonb_typeof(recursos) = 'string';

UPDATE public.propostas_comerciais SET
  assinatura_vendedor = CASE WHEN jsonb_typeof(assinatura_vendedor) = 'string' THEN (assinatura_vendedor #>> '{}')::jsonb ELSE assinatura_vendedor END,
  diagnostico = CASE WHEN jsonb_typeof(diagnostico) = 'string' THEN (diagnostico #>> '{}')::jsonb ELSE diagnostico END,
  extras = CASE WHEN jsonb_typeof(extras) = 'string' THEN (extras #>> '{}')::jsonb ELSE extras END
  WHERE jsonb_typeof(assinatura_vendedor) = 'string' OR jsonb_typeof(diagnostico) = 'string' OR jsonb_typeof(extras) = 'string';
