-- Bug: moveDealStage() (chamada pelo drag-and-drop do Kanban e pela barra de
-- progresso do drawer do negócio) só LIMPAVA won_at/lost_at ao SAIR da etapa
-- Cliente/Perdido, nunca gravava ao ENTRAR — só o botão explícito "Marcar
-- como Ganho/Perdido" fazia isso, raramente usado (quase todo mundo move o
-- card arrastando). Resultado: todo negócio na etapa "Cliente" tinha
-- won_at nulo, tornando impossível medir ciclo de venda, conversão por
-- período ou qualquer análise de CAC/LTV a partir do pipeline.
--
-- Fix de código já aplicado em src/services/api.ts (moveDealStage) e
-- src/components/Kanban.tsx (checagem de título de coluna, que ainda
-- procurava a etapa antiga "Ganho", renomeada pra "Cliente").
--
-- Este backfill cobre os negócios que já estavam em Cliente/Perdido antes
-- do fix, usando updated_at como melhor aproximação disponível pra data de
-- entrada na etapa (não existe histórico de transição de estágio por
-- negócio hoje, só a última modificação).
UPDATE public.deals
SET won_at = updated_at
WHERE stage_id = (SELECT id FROM public.pipeline_stages WHERE lower(title) = 'cliente' LIMIT 1)
  AND won_at IS NULL;

UPDATE public.deals
SET lost_at = updated_at
WHERE stage_id = (SELECT id FROM public.pipeline_stages WHERE lower(title) = 'perdido' LIMIT 1)
  AND lost_at IS NULL;

-- Limpeza: negócio atualmente em Cliente não devia carregar um lost_at
-- "fantasma" de uma passagem antiga por Perdido (o código antigo não
-- limpava isso ao entrar em Cliente); e vice-versa.
UPDATE public.deals
SET lost_at = NULL, lost_reason = NULL
WHERE stage_id = (SELECT id FROM public.pipeline_stages WHERE lower(title) = 'cliente' LIMIT 1)
  AND lost_at IS NOT NULL;

UPDATE public.deals
SET won_at = NULL
WHERE stage_id = (SELECT id FROM public.pipeline_stages WHERE lower(title) = 'perdido' LIMIT 1)
  AND won_at IS NOT NULL;
