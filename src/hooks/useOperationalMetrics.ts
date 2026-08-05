import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ConversationStatus = 'nina' | 'human' | 'paused';

interface ConversationSnapshot {
  status: ConversationStatus;
  queue_id: string | null;
}

export const NO_QUEUE_KEY = 'sem_fila';

export interface OperationalMetrics {
  total: number;
  byStatus: Record<ConversationStatus, number>;
  // Chaveado por queues.id (UUID) — 'sem_fila' agrupa conversas sem fila atribuída.
  byQueue: Record<string, number>;
  loading: boolean;
}

const EMPTY_BY_STATUS: Record<ConversationStatus, number> = { nina: 0, human: 0, paused: 0 };

function computeMetrics(map: Map<string, ConversationSnapshot>): Omit<OperationalMetrics, 'loading'> {
  const byStatus = { ...EMPTY_BY_STATUS };
  const byQueue: Record<string, number> = {};

  map.forEach((conv) => {
    byStatus[conv.status] = (byStatus[conv.status] || 0) + 1;
    const queueKey = conv.queue_id || NO_QUEUE_KEY;
    byQueue[queueKey] = (byQueue[queueKey] || 0) + 1;
  });

  return { total: map.size, byStatus, byQueue };
}

// Contagem de conversas abertas por status/fila, ao vivo. Hook enxuto e
// separado de useConversations.ts (que carrega mensagens completas) —
// aqui só guardamos status/queue_id por conversa ativa.
export function useOperationalMetrics() {
  const [metrics, setMetrics] = useState<OperationalMetrics>({
    total: 0,
    byStatus: EMPTY_BY_STATUS,
    byQueue: {},
    loading: true,
  });
  const conversationsRef = useRef<Map<string, ConversationSnapshot>>(new Map());

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const fetchSnapshot = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, status, queue_id, is_active')
        .eq('is_active', true);

      if (error) {
        console.error('[useOperationalMetrics] Erro ao buscar conversas:', error);
        return;
      }

      const map = new Map<string, ConversationSnapshot>();
      (data || []).forEach((conv: any) => {
        map.set(conv.id, { status: conv.status, queue_id: conv.queue_id });
      });
      conversationsRef.current = map;
      setMetrics({ ...computeMetrics(map), loading: false });
    };

    fetchSnapshot();

    const channel = supabase
      .channel('dashboard-conversations-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'conversations' },
        (payload) => {
          const conv = payload.new as any;
          if (!conv.is_active) return;
          conversationsRef.current.set(conv.id, { status: conv.status, queue_id: conv.queue_id });
          setMetrics({ ...computeMetrics(conversationsRef.current), loading: false });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations' },
        (payload) => {
          const conv = payload.new as any;
          if (!conv.is_active) {
            conversationsRef.current.delete(conv.id);
          } else {
            conversationsRef.current.set(conv.id, { status: conv.status, queue_id: conv.queue_id });
          }
          setMetrics({ ...computeMetrics(conversationsRef.current), loading: false });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[useOperationalMetrics] Canal Realtime falhou, ativando polling de fallback');
          if (!pollInterval) {
            pollInterval = setInterval(fetchSnapshot, 10_000);
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, []);

  return metrics;
}
