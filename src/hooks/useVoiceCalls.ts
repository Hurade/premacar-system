import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface VoiceCall {
  id: string;
  contact_id: string;
  campaign_id: string | null;
  call_sid: string | null;
  status: string;
  duration_seconds: number | null;
  dtmf_response: string | null;
  audio_url: string | null;
  error_message: string | null;
  call_type: 'campaign' | 'manual';
  created_at: string;
}

const ACTIVE_STATUSES = ['initiated', 'queued', 'ringing', 'in-progress'];

export function useVoiceCalls(contactId: string | undefined) {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchCalls = async () => {
    if (!contactId) return;
    const { data, error } = await (supabase as any)
      .from('voice_calls')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[useVoiceCalls] Erro ao buscar chamadas:', error);
      return;
    }
    setCalls(data || []);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchCalls();

    if (!contactId) return;

    const channel = supabase
      .channel(`voice-calls-${contactId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'voice_calls', filter: `contact_id=eq.${contactId}` },
        () => fetchCalls()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  const hasActiveCall = calls.some((c) => ACTIVE_STATUSES.includes(c.status));

  const startCall = async (message?: string) => {
    if (!contactId) return;
    try {
      const { data, error } = await supabase.functions.invoke('make-voice-call', {
        body: { contactId, message, callType: 'manual', initiatedBy: user?.id },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error);
      toast.success('Ligação iniciada');
      fetchCalls();
    } catch (err: any) {
      toast.error(`Erro ao iniciar ligação: ${err.message || err}`);
    }
  };

  return { calls, loading, hasActiveCall, startCall };
}
