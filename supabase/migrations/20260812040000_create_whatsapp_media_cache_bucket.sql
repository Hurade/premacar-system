-- ============================================================
-- Cache de mídia recebida do WhatsApp (áudio/imagem/documento).
--
-- A Evolution API (getBase64FromMediaMessage) só garante o download da
-- mesma mensagem de forma confiável UMA vez — chamadas repetidas para o
-- mesmo key.id podem falhar (comportamento documentado em issues da
-- própria Evolution API). Hoje baixamos a mídia duas vezes pra cada
-- mensagem: uma pelo nina-orchestrator/message-grouper (transcrição/
-- análise) e outra pelo media-proxy (reprodução no chat) — a segunda
-- chamada é a que costuma falhar, deixando áudio/anexo sem tocar.
--
-- Bucket privado: acesso só via service_role (usado pelas edge
-- functions), nunca exposto direto ao navegador — quem serve pro
-- cliente final continua sendo o media-proxy, preservando o mesmo
-- controle de acesso de hoje.
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media-cache', 'whatsapp-media-cache', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Service role manages whatsapp-media-cache" ON storage.objects;
CREATE POLICY "Service role manages whatsapp-media-cache" ON storage.objects
FOR ALL TO service_role
USING (bucket_id = 'whatsapp-media-cache')
WITH CHECK (bucket_id = 'whatsapp-media-cache');
