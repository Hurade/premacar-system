-- ═══════════════════════════════════════════════════════════════════
-- Fix: claim_nina_processing_batch — DB-level per-conversation dedup
--
-- Problema: a função original podia retornar múltiplos itens da mesma
-- conversa em um único batch. Com invocações concorrentes do orchestrator
-- isso resultava em respostas duplicadas sendo geradas.
--
-- Solução: antes de reivindicar, marcar itens obsoletos (mesma
-- conversation_id, mais antigos) como 'completed'. Em seguida, usar
-- DISTINCT ON para garantir no máximo 1 item por conversa.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.claim_nina_processing_batch(p_limit INTEGER DEFAULT 50)
RETURNS SETOF nina_processing_queue AS $$
BEGIN
  -- Passo 1: Deduplicação automática
  -- Para cada conversation_id com múltiplos itens 'pending', mantém só o
  -- mais recente. Os mais antigos são marcados como 'completed' imediatamente.
  UPDATE public.nina_processing_queue AS old_item
  SET
    status        = 'completed',
    updated_at    = now(),
    processed_at  = now(),
    error_message = 'Deduplicado: item mais recente existe para esta conversa'
  WHERE old_item.status = 'pending'
    AND (old_item.scheduled_for IS NULL OR old_item.scheduled_for <= now())
    AND EXISTS (
      SELECT 1
      FROM public.nina_processing_queue newer
      WHERE newer.conversation_id = old_item.conversation_id
        AND newer.status          = 'pending'
        AND newer.created_at      > old_item.created_at
        AND (newer.scheduled_for IS NULL OR newer.scheduled_for <= now())
    );

  -- Passo 2: Reivindicar um item por conversa (o mais recente)
  -- DISTINCT ON garante unicidade; FOR UPDATE SKIP LOCKED garante segurança
  -- entre invocações concorrentes.
  RETURN QUERY
  WITH per_conv AS (
    SELECT DISTINCT ON (conversation_id) id
    FROM public.nina_processing_queue
    WHERE status = 'pending'
      AND (scheduled_for IS NULL OR scheduled_for <= now())
    ORDER BY conversation_id, priority DESC, created_at DESC
  ),
  cte AS (
    SELECT npq.id
    FROM public.nina_processing_queue npq
    WHERE npq.id IN (SELECT id FROM per_conv)
    ORDER BY npq.priority DESC, npq.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.nina_processing_queue n
  SET status = 'processing', updated_at = now()
  WHERE n.id IN (SELECT id FROM cte)
  RETURNING n.*;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
