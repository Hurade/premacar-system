-- Troca do modelo de embeddings: saiu do Lovable AI Gateway
-- (google/gemini-embedding-001, 3072 dimensões) para o AI Gateway próprio
-- (self-hosted, modelo local intfloat/multilingual-e5-large via fastembed,
-- 1024 dimensões). Dimensões diferentes = espaço vetorial incompatível —
-- os embeddings antigos não servem pra nada no modelo novo, por isso viram
-- NULL na troca de tipo (match_documents já filtra `embedding IS NOT NULL`,
-- então isso só faz esses chunks saírem da busca até serem reprocessados).
ALTER TABLE public.knowledge_chunks
  ALTER COLUMN embedding TYPE extensions.vector(1024) USING NULL;

-- 1024 dimensões está dentro do limite de indexação do pgvector (2000) —
-- diferente da situação anterior com 3072, agora dá pra ter um índice de
-- verdade em vez de sequential scan.
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw
  ON public.knowledge_chunks
  USING hnsw (embedding extensions.vector_cosine_ops);

-- Marca documentos com chunks agora sem embedding como pendentes de
-- reprocessamento (a função reembed_all do knowledge-ingest cuida disso).
UPDATE public.knowledge_documents
SET status = 'pending', error_message = 'Reprocessamento necessário: modelo de embeddings trocado'
WHERE status = 'ready'
  AND EXISTS (
    SELECT 1 FROM public.knowledge_chunks kc
    WHERE kc.document_id = knowledge_documents.id AND kc.embedding IS NULL
  );
