-- Bucket público pra áudios gravados/enviados pelo chat (mensagem de voz
-- do atendente). Diferente do bucket "audio-messages" existente (que só
-- aceita insert via service_role, usado pra TTS/respostas automáticas),
-- este aceita upload direto do navegador do atendente.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-audio', 'chat-audio', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read chat-audio" ON storage.objects;
CREATE POLICY "Public read chat-audio" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'chat-audio');

DROP POLICY IF EXISTS "Authenticated upload chat-audio" ON storage.objects;
CREATE POLICY "Authenticated upload chat-audio" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-audio');
