import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface WindowState {
  windowStatus: 'open' | 'expired' | 'not_found';
  canSendFreeMessage: boolean;
  requiresTemplate: boolean;
  expiresAt: Date | null;
  expiredAt: Date | null;
  hoursRemaining: number;
  hoursSinceExpired: number;
  loading: boolean;
}

export function useConversationWindow(conversationId: string | null, apiSource?: string) {
  const [state, setState] = useState<WindowState>({
    windowStatus: 'open',
    canSendFreeMessage: true,
    requiresTemplate: false,
    expiresAt: null,
    expiredAt: null,
    hoursRemaining: 24,
    hoursSinceExpired: 0,
    loading: true,
  });

  const checkWindow = useCallback(async () => {
    if (!conversationId) return;
    
    // Evolution API doesn't have 24h window
    if (apiSource && apiSource !== 'meta') {
      setState(prev => ({
        ...prev,
        windowStatus: 'open',
        canSendFreeMessage: true,
        requiresTemplate: false,
        loading: false,
      }));
      return;
    }

    try {
      const { data, error } = await supabase.rpc('check_conversation_window', {
        p_conversation_id: conversationId,
      });

      if (error) throw error;

      const result = data as any;
      setState({
        windowStatus: result.window_status || 'open',
        canSendFreeMessage: result.can_send_free_message ?? true,
        requiresTemplate: result.requires_template ?? false,
        expiresAt: result.expires_at ? new Date(result.expires_at) : null,
        expiredAt: result.expired_at ? new Date(result.expired_at) : null,
        hoursRemaining: result.hours_remaining ?? 24,
        hoursSinceExpired: result.hours_since_expired ?? 0,
        loading: false,
      });
    } catch (error) {
      console.error('Erro ao verificar janela:', error);
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [conversationId, apiSource]);

  useEffect(() => {
    checkWindow();
    // Re-check every minute
    const interval = setInterval(checkWindow, 60000);
    return () => clearInterval(interval);
  }, [checkWindow]);

  return { ...state, refetch: checkWindow };
}
