-- Bug: a conexão "Meta Oficial" foi gravada com api_type = 'meta', mas todo
-- o resto do código (ConnectionModal, campanhas, roteamento de envio em
-- useConversations.ts, ChatInterface.tsx) compara com a string exata
-- 'meta_official'. Isso escondia os campos de credencial Meta na tela de
-- editar E fazia useConversations.ts classificar a conversa como
-- apiSource='evolution' (por não bater na comparação), ou seja, tentando
-- resolver credenciais/envio pelo caminho errado.
UPDATE public.whatsapp_connections
SET api_type = 'meta_official'
WHERE api_type = 'meta';
