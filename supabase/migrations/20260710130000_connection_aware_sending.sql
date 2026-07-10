-- ============================================================
-- Torna o envio de WhatsApp "connection-aware": hoje todo envio real
-- (whatsapp-sender, nina-orchestrator, campaign-processor,
-- recurring-campaign-processor, followup-processor) busca credenciais
-- de uma única linha global em nina_settings, nunca de
-- whatsapp_connections — mesmo havendo múltiplas conexões cadastradas.
-- Isso torna impossível transferir uma conversa de conexão de verdade.
--
-- conversations.connection_id já existe (só nunca foi consumido por
-- nada); aqui adicionamos o mesmo conceito em send_queue (para o item
-- já nascer com a conexão certa, mesmo que a conversa seja transferida
-- depois de enfileirado) e em campaigns/recurring_campaigns (que hoje
-- não têm nenhum conceito de "qual conexão usar").
-- ============================================================

ALTER TABLE public.send_queue
  ADD COLUMN connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

ALTER TABLE public.campaigns
  ADD COLUMN connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;

ALTER TABLE public.recurring_campaigns
  ADD COLUMN connection_id UUID REFERENCES public.whatsapp_connections(id) ON DELETE SET NULL;
