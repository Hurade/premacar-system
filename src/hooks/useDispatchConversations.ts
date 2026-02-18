import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays, subWeeks, subMonths, startOfDay } from 'date-fns';

export type DateFilterType = '7days' | '14days' | '30days' | 'week' | 'month' | 'custom';
export type StatusFilter = 'all' | 'sent' | 'delivered' | 'read';

export interface DispatchFilters {
  dateFilter: DateFilterType;
  customDateFrom?: string;
  customDateTo?: string;
  statusFilter: StatusFilter;
}

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

function getDateFrom(filters: DispatchFilters): Date {
  const now = new Date();
  switch (filters.dateFilter) {
    case '7days':
      return subDays(startOfDay(now), 7);
    case '14days':
      return subDays(startOfDay(now), 14);
    case '30days':
      return subDays(startOfDay(now), 30);
    case 'week':
      return subWeeks(startOfDay(now), 1);
    case 'month':
      return subMonths(startOfDay(now), 1);
    case 'custom':
      return filters.customDateFrom ? new Date(filters.customDateFrom) : subDays(startOfDay(now), 7);
    default:
      return subDays(startOfDay(now), 7);
  }
}

export function useDispatchConversations(filters: DispatchFilters) {
  return useQuery({
    queryKey: ['dispatch-conversations', filters],
    queryFn: async () => {
      const dateFrom = getDateFrom(filters);
      const dateTo = filters.dateFilter === 'custom' && filters.customDateTo
        ? new Date(filters.customDateTo + 'T23:59:59')
        : new Date();

      // Step 1: Fetch dispatched conversations in date range (single query)
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
        .gte('dispatch_sent_at', dateFrom.toISOString())
        .lte('dispatch_sent_at', dateTo.toISOString())
        .order('dispatch_sent_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      if (!conversations || conversations.length === 0) return [];

      const convIds = conversations.map(c => c.id);

      // Step 2: Batch - check which ones have user replies
      const { data: userMessages } = await supabase
        .from('messages')
        .select('conversation_id')
        .in('conversation_id', convIds)
        .eq('from_type', 'user');

      const repliedIds = new Set((userMessages || []).map(m => m.conversation_id));
      const unrepliedConvs = conversations.filter(c => !repliedIds.has(c.id));

      if (unrepliedConvs.length === 0) return [];

      const unrepliedIds = unrepliedConvs.map(c => c.id);

      // Step 3: Batch fetch last message for ALL unreplied conversations at once
      // Using a query that gets the most recent message per conversation
      const { data: allLastMessages } = await supabase
        .from('messages')
        .select('conversation_id, content, status, sent_at')
        .in('conversation_id', unrepliedIds)
        .order('sent_at', { ascending: false });

      // Build a map of conversation_id -> last message (first occurrence = most recent)
      const lastMsgMap = new Map<string, { content: string | null; status: string }>();
      for (const msg of (allLastMessages || [])) {
        if (!lastMsgMap.has(msg.conversation_id)) {
          lastMsgMap.set(msg.conversation_id, { content: msg.content, status: msg.status });
        }
      }

      // Step 4: Build results and apply status filter
      const result: DispatchConversation[] = [];

      for (const conv of unrepliedConvs) {
        const contact = conv.contact as any;
        const lastMsg = lastMsgMap.get(conv.id);

        let status: 'sent' | 'delivered' | 'read' = 'sent';
        if (lastMsg?.status === 'read') status = 'read';
        else if (lastMsg?.status === 'delivered') status = 'delivered';

        // Apply status filter
        if (filters.statusFilter !== 'all' && status !== filters.statusFilter) continue;

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
    refetchInterval: 60000,
  });
}
