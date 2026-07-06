import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type ConversationStatus = 'nina' | 'human' | 'paused';
type TeamAssignment = 'mateus' | 'igor' | 'fe' | 'vendas' | 'suporte';

interface ConversationSnapshot {
  status: ConversationStatus;
  assigned_team: TeamAssignment | null;
}

export interface OperationalMetrics {
  total: number;
  byStatus: Record<ConversationStatus, number>;
  byTeam: Record<TeamAssignment | 'sem_equipe', number>;
  loading: boolean;
}

const EMPTY_BY_STATUS: Record<ConversationStatus, number> = { nina: 0, human: 0, paused: 0 };
const EMPTY_BY_TEAM: Record<TeamAssignment | 'sem_equipe', number> = {
  mateus: 0, igor: 0, fe: 0, vendas: 0, suporte: 0, sem_equipe: 0,
};

function computeMetrics(map: Map<string, ConversationSnapshot>): Omit<OperationalMetrics, 'loading'> {
  const byStatus = { ...EMPTY_BY_STATUS };
  const byTeam = { ...EMPTY_BY_TEAM };

  map.forEach((conv) => {
    byStatus[conv.status] = (byStatus[conv.status] || 0) + 1;
    const teamKey = conv.assigned_team || 'sem_equipe';
    byTeam[teamKey] = (byTeam[teamKey] || 0) + 1;
  });

  return { total: map.size, byStatus, byTeam };
}

// Contagem de conversas abertas por status/equipe, ao vivo. Hook enxuto e
// separado de useConversations.ts (que carrega mensagens completas) —
// aqui só guardamos status/assigned_team por conversa ativa.
export function useOperationalMetrics() {
  const [metrics, setMetrics] = useState<OperationalMetrics>({
    total: 0,
    byStatus: EMPTY_BY_STATUS,
    byTeam: EMPTY_BY_TEAM,
    loading: true,
  });
  const conversationsRef = useRef<Map<string, ConversationSnapshot>>(new Map());

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const fetchSnapshot = async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select('id, status, assigned_team, is_active')
        .eq('is_active', true);

      if (error) {
        console.error('[useOperationalMetrics] Erro ao buscar conversas:', error);
        return;
      }

      const map = new Map<string, ConversationSnapshot>();
      (data || []).forEach((conv: any) => {
        map.set(conv.id, { status: conv.status, assigned_team: conv.assigned_team });
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
          conversationsRef.current.set(conv.id, { status: conv.status, assigned_team: conv.assigned_team });
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
            conversationsRef.current.set(conv.id, { status: conv.status, assigned_team: conv.assigned_team });
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
