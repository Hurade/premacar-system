-- O código de anexo do chat (handleFileUpload em ChatInterface.tsx) sempre
-- assumiu que esse bucket existia, mas nunca foi criado em nenhuma
-- migration — só existia via alguma configuração manual que se perdeu (ou
-- nunca existiu de fato), causando "Erro ao enviar arquivo" pra sempre.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read chat-attachments" ON storage.objects;
CREATE POLICY "Public read chat-attachments" ON storage.objects
FOR SELECT TO public USING (bucket_id = 'chat-attachments');

DROP POLICY IF EXISTS "Authenticated upload chat-attachments" ON storage.objects;
CREATE POLICY "Authenticated upload chat-attachments" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');
