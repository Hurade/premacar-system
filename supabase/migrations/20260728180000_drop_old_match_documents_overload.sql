-- A migration anterior (20260728173600) usou CREATE OR REPLACE FUNCTION
-- para adicionar o parâmetro p_queue_id a match_documents, mas como mudou a
-- assinatura (novo parâmetro), o Postgres não substituiu a função antiga —
-- criou uma segunda sobrecarga (overload) com o mesmo nome. Fica a versão
-- de 3 argumentos (sem filtro por fila) órfã no banco, sem nenhum chamador
-- (só o nina-orchestrator usa esta função, e sempre passa p_queue_id).
DROP FUNCTION IF EXISTS public.match_documents(extensions.vector, float, integer);
