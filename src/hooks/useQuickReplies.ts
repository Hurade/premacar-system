import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type QuickReplyScope = 'global' | 'individual';

export interface QuickReply {
  id: string;
  trigger: string;
  text: string;
  scope: QuickReplyScope;
  created_by: string | null;
}

// Antes vivia só em localStorage ('prema_quick_replies') — sumia com
// limpeza de cache/troca de navegador e nunca era visto pelo resto da
// equipe. Agora persiste de verdade, compartilhado — "global" fica
// visível/editável por toda a equipe, "individual" só por quem criou
// (RLS já garante isso no SELECT; aqui só precisa mandar o scope certo).
export function useQuickReplies() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReplies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quick_replies')
        .select('id, trigger, text, scope, created_by')
        .order('trigger', { ascending: true });
      if (error) throw error;
      setReplies((data as QuickReply[]) || []);
    } catch (err) {
      console.error('[useQuickReplies] Erro ao buscar:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReplies();
  }, [fetchReplies]);

  const addReply = async (trigger: string, text: string, scope: QuickReplyScope = 'global') => {
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from('quick_replies').insert({
      trigger,
      text,
      scope,
      created_by: userData.user?.id ?? null,
    });
    if (error) throw error;
    await fetchReplies();
  };

  const updateReply = async (id: string, trigger: string, text: string, scope?: QuickReplyScope) => {
    const { error } = await supabase
      .from('quick_replies')
      .update({ trigger, text, ...(scope ? { scope } : {}), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await fetchReplies();
  };

  const deleteReply = async (id: string) => {
    const { error } = await supabase.from('quick_replies').delete().eq('id', id);
    if (error) throw error;
    await fetchReplies();
  };

  return { replies, loading, refetch: fetchReplies, addReply, updateReply, deleteReply };
}
