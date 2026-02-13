import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DispatchConversation {
  id: string;
  contactName: string;
  contactPhone: string;
  dispatchSentAt: string;
  lastMessageAt: string;
  status: 'sent' | 'delivered' | 'read';
  campaignName?: string;
  lastMessageContent?: string;
}

export function useDispatchConversations() {
  return useQuery({
    queryKey: ['dispatch-conversations'],
    queryFn: async () => {
      // Fetch conversations that were dispatched but have NO user reply yet
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id,
          dispatch_sent_at,
          last_message_at,
          contact:contacts(name, call_name, phone_number)
        `)
        .not('dispatch_sent_at', 'is', null)
        .eq('is_active', true)
        .order('dispatch_sent_at', { ascending: false });

      if (error) throw error;
      if (!conversations || conversations.length === 0) return [];

      // Check which ones have NO user reply (those stay in dispatch view)
      const convIds = conversations.map(c => c.id);
      const { data: userMessages } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .eq('from_type', 'user');

      const repliedIds = new Set((userMessages || []).map(m => m.conversation_id));

      // Also fetch last message for each unreplied conversation
      const unrepliedConvs = conversations.filter(c => !repliedIds.has(c.id));
      
      const result: DispatchConversation[] = [];
      
      for (const conv of unrepliedConvs) {
        const contact = conv.contact as any;
        
        // Get last message to show status
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, status')
          .eq('conversation_id', conv.id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .single();

        let status: 'sent' | 'delivered' | 'read' = 'sent';
        if (lastMsg?.status === 'read') status = 'read';
        else if (lastMsg?.status === 'delivered') status = 'delivered';

        result.push({
          id: conv.id,
          contactName: contact?.name || contact?.call_name || contact?.phone_number || 'Desconhecido',
          contactPhone: contact?.phone_number || '',
          dispatchSentAt: conv.dispatch_sent_at!,
          lastMessageAt: conv.last_message_at,
          status,
          lastMessageContent: lastMsg?.content || '',
        });
      }

      return result;
    },
    refetchInterval: 30000, // Refresh every 30s
  });
}
