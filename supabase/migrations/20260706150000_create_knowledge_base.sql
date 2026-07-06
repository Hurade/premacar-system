-- ============================================================
-- FASE 1.3: Base de conhecimento (RAG) para o agente de IA
--
-- Dimensão do embedding confirmada em produção (3072, modelo
-- google/gemini-embedding-001 via Lovable AI Gateway) usando a edge function
-- de diagnóstico check-embedding-dimension. Como 3072 > 2000 (limite de
-- indexação do pgvector para ivfflat/hnsw), a coluna `embedding` NÃO tem
-- índice vetorial — a busca por similaridade faz sequential scan, o que é
-- aceitável para o volume esperado de uma base de conhecimento interna.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT, -- 'pdf' | 'xlsx' | 'csv' | 'txt'
  storage_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  chunk_count INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding extensions.vector(3072),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_document_id ON public.knowledge_chunks(document_id);
-- Sem índice vetorial (ivfflat/hnsw): 3072 dimensões excede o limite de
-- indexação do pgvector (2000). Busca por similaridade usa sequential scan.

CREATE TRIGGER update_knowledge_documents_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Busca por similaridade — usada pelo nina-orchestrator para montar o
-- bloco <base_de_conhecimento> do prompt.
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding extensions.vector(3072),
  match_threshold FLOAT DEFAULT 0.72,
  match_count INT DEFAULT 4
) RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  similarity FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT kc.id, kc.document_id, kc.content,
         1 - (kc.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_chunks kc
  JOIN public.knowledge_documents kd ON kd.id = kc.document_id
  WHERE kd.status = 'ready'
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage knowledge_documents"
  ON public.knowledge_documents FOR ALL TO authenticated
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read knowledge_chunks"
  ON public.knowledge_chunks FOR SELECT TO authenticated
  USING (auth.role() = 'authenticated');
-- Sem policy de escrita para 'authenticated' em knowledge_chunks: só a edge
-- function de ingestão (service_role) grava chunks/embeddings.

-- Flag para ativar/desativar RAG sem precisar de deploy
ALTER TABLE public.nina_settings
  ADD COLUMN IF NOT EXISTS rag_enabled BOOLEAN NOT NULL DEFAULT false;

-- Bucket de storage para os arquivos originais (PDF/XLSX/CSV)
INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-base', 'knowledge-base', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Service role manages knowledge-base bucket"
  ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'knowledge-base');

CREATE POLICY "Authenticated users can upload to knowledge-base"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'knowledge-base');

CREATE POLICY "Authenticated users can read knowledge-base"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'knowledge-base');

CREATE POLICY "Authenticated users can delete from knowledge-base"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'knowledge-base');
