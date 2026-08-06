-- ============================================================
-- Corrige o roteador "Atendimento" (trigger_type='default') tratando
-- cliente já confirmado como comercial.
--
-- A tag "Cliente" já injeta uma instrução pro contexto da IA via
-- tag_definitions.ai_instruction (bloco <instrucoes_por_tag>), mas essa
-- instrução só orienta o TOM da conversa ("não pergunte se é cliente")
-- — não influencia a decisão de setor. O roteador continuava caindo no
-- desempate "prefira comercial em caso de dúvida", tratando clientes já
-- confirmados como leads novos.
--
-- Usa replace() num trecho específico em vez de sobrescrever o
-- system_prompt inteiro, pra não apagar customizações feitas via tela
-- de Configurações > Agentes desde o seed original (migration
-- 20260728173600). Se o texto já tiver sido editado e não bater mais
-- com o original, este UPDATE simplesmente não altera nada (sem erro).
-- ============================================================

UPDATE public.agent_configs
SET system_prompt = replace(
  system_prompt,
  'na segunda mensagem, decida com a informação que tiver (prefira comercial em caso de dúvida entre comercial/outro, já que é o cenário mais comum de primeiro contato).',
  'na segunda mensagem, decida com a informação que tiver (prefira comercial em caso de dúvida entre comercial/outro, já que é o cenário mais comum de primeiro contato).

IMPORTANTE — cliente já confirmado: se houver uma instrução de tag (bloco <instrucoes_por_tag>) dizendo que o contato já é cliente confirmado, essa preferência por comercial NÃO se aplica. Nunca rotule um cliente já confirmado como comercial — ele não é lead novo. Identifique o que ele precisa e rotule para suporte (erro/dúvida técnica), cs (relacionamento/sucesso/risco de cancelamento) ou financeiro (cobrança/pagamento); se o assunto não ficar claro nem após a pergunta de desambiguação, prefira cs.'
)
WHERE trigger_type = 'default' AND is_active = true;
