import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QuickReply {
  id: string;
  trigger: string;
  text: string;
}

// Antes vivia só em localStorage ('prema_quick_replies') — sumia com
// limpeza de cache/troca de navegador e nunca era visto pelo resto da
// equipe. Agora persiste de verdade, compartilhado.
export function useQuickReplies() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReplies = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('quick_replies')
        .select('id, trigger, text')
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

  const addReply = async (trigger: string, text: string) => {
    const { error } = await supabase.from('quick_replies').insert({ trigger, text });
    if (error) throw error;
    await fetchReplies();
  };

  const updateReply = async (id: string, trigger: string, text: string) => {
    const { error } = await supabase
      .from('quick_replies')
      .update({ trigger, text, updated_at: new Date().toISOString() })
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
