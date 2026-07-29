-- Permite que uma tag carregue uma instrução para a IA (ex.: tag "Cliente"
-- faz o agente pular a pergunta "você já é cliente?" e ir direto identificar
-- o que a pessoa precisa). has_action separado de ai_instruction para a UI
-- poder desligar a ação sem apagar o texto já escrito.
ALTER TABLE public.tag_definitions
  ADD COLUMN has_action BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN ai_instruction TEXT;
