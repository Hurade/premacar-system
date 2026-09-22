-- Habilitar REPLICA IDENTITY FULL para capturar todas as mudanças
ALTER TABLE deals REPLICA IDENTITY FULL;
ALTER TABLE pipeline_stages REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deals') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE deals;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pipeline_stages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE pipeline_stages;
  END IF;
END $$;