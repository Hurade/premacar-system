import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DBMessage, UIMessage, transformDBToUIMessage, ApiSource } from '@/types';

export interface HistorySession {
  conversationId: string;
  isActive: boolean;
  protocolNumber: string | null;
  apiSource: ApiSource;
  queueName: string | null;
  connectionName: string | null;
  attendantName: string | null;
  startedAt: string;
  lastMessageAt: string;
  messages: UIMessage[];
}

interface UseContactHistoryOptions {
  excludeConversationId?: string;
  enabled?: boolean;
}

async function fetchAttendantNames(userIds: (string | null)[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(userIds.filter((id): id is string => !!id))];
  if (uniqueIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('team_members')
    .select('id, name')
    .in('id', uniqueIds);

  if (error) throw error;

  return new Map((data || []).map((member) => [member.id, member.name]));
}

async function fetchContactHistory(
  contactId: string,
  excludeConversationId?: string
): Promise<HistorySession[]> {
  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select(
      `id, status, is_active, assigned_user_id, started_at, last_message_at, protocol_number, api_source,
       queue:queues(name),
       connection:whatsapp_connections(name)`
    )
    .eq('contact_id', contactId)
    .order('started_at', { ascending: true });

  if (convError) throw convError;

  const sessions = (conversations || []).filter(
    (conv) => conv.id !== excludeConversationId
  );

  if (sessions.length === 0) return [];

  const conversationIds = sessions.map((conv) => conv.id);

  const [{ data: messages, error: msgError }, attendantNameById] = await Promise.all([
    supabase
      .from('messages')
      .select('*')
      .in('conversation_id', conversationIds)
      .order('sent_at', { ascending: true }),
    fetchAttendantNames(sessions.map((conv) => conv.assigned_user_id)),
  ]);

  if (msgError) throw msgError;

  const messagesByConversation = new Map<string, DBMessage[]>();
  for (const msg of (messages || []) as DBMessage[]) {
    const list = messagesByConversation.get(msg.conversation_id) || [];
    list.push(msg);
    messagesByConversation.set(msg.conversation_id, list);
  }

  return sessions.map((conv) => ({
    conversationId: conv.id,
    isActive: conv.is_active,
    protocolNumber: conv.protocol_number || null,
    apiSource: (conv.api_source as ApiSource) || 'evolution',
    queueName: (conv.queue as { name: string } | null)?.name || null,
    connectionName: (conv.connection as { name: string } | null)?.name || null,
    attendantName: conv.assigned_user_id ? attendantNameById.get(conv.assigned_user_id) || null : null,
    startedAt: conv.started_at,
    lastMessageAt: conv.last_message_at,
    messages: (messagesByConversation.get(conv.id) || []).map(transformDBToUIMessage),
  }));
}

export function useContactHistory(
  contactId: string | undefined,
  options: UseContactHistoryOptions = {}
) {
  const { excludeConversationId, enabled = true } = options;

  const query = useQuery({
    queryKey: ['contact-history', contactId, excludeConversationId],
    queryFn: () => fetchContactHistory(contactId as string, excludeConversationId),
    enabled: enabled && !!contactId,
    staleTime: 30_000,
  });

  const sessions = query.data || [];
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);

  return {
    sessions,
    totalMessages,
    isLoading: query.isLoading,
    error: query.error,
  };
}
