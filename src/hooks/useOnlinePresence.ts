import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User } from '@supabase/supabase-js';

export interface OnlineAgent {
  user_id: string;
  full_name: string;
  online_at: string;
}

const PRESENCE_CHANNEL_NAME = 'online-agents';

// Presence API nativa do Supabase Realtime — sem tabela nova. Rastreia quem
// está logado agora (não fica histórico; é só o estado atual da sessão).
export function useOnlinePresence(user: User | null | undefined) {
  const [onlineAgents, setOnlineAgents] = useState<OnlineAgent[]>([]);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setOnlineAgents([]);
      return;
    }

    trackedRef.current = false;
    const channel = supabase.channel(PRESENCE_CHANNEL_NAME, {
      config: { presence: { key: user.id } },
    });

    const syncState = () => {
      const state = channel.presenceState<OnlineAgent>();
      const byUser = new Map<string, OnlineAgent>();
      Object.values(state).forEach((presences) => {
        presences.forEach((p) => {
          // Dedup por user_id (mesmo usuário pode ter múltiplas abas abertas)
          byUser.set(p.user_id, p);
        });
      });
      setOnlineAgents(Array.from(byUser.values()));
    };

    channel
      .on('presence', { event: 'sync' }, syncState)
      .on('presence', { event: 'join' }, syncState)
      .on('presence', { event: 'leave' }, syncState)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && !trackedRef.current) {
          trackedRef.current = true;
          channel.track({
            user_id: user.id,
            full_name: user.user_metadata?.full_name || user.email || 'Agente',
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return onlineAgents;
}
