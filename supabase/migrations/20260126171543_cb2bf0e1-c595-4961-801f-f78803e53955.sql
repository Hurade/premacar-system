-- 1. Adicionar tabelas à publicação supabase_realtime
--
-- Idempotente: um projeto Supabase novo já cria a publicação
-- supabase_realtime com algumas tabelas padrão como membro (varia por
-- template/versão), então um ALTER PUBLICATION ... ADD TABLE direto falha
-- com "already member of publication" dependendo do que o projeto já
-- trouxe de fábrica. Cada tabela só é adicionada se ainda não for membro.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['messages', 'conversations', 'contacts', 'deals', 'pipeline_stages', 'teams', 'team_functions', 'team_members', 'appointments']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
