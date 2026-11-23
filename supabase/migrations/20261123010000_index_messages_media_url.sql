-- media-proxy consulta messages filtrando por media_url (ver
-- supabase/functions/media-proxy/index.ts) sem índice nessa coluna —
-- full scan na tabela toda a cada busca de mídia em cache (~1s por
-- chamada, medido via pg_stat_statements). Índice parcial (só linhas
-- com mídia) mantém o índice pequeno.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_media_url
  ON public.messages (media_url)
  WHERE media_url IS NOT NULL;
