import { DBMessage, transformDBToUIMessage, UIMessage } from '@/types';
import { supabase } from '@/integrations/supabase/client';

export interface ConversationMessageWeek {
  conversationId: string;
  weekStart: string;
  messageCount: number;
}

export async function fetchConversationMessageWeeks(
  conversationIds: string[]
): Promise<ConversationMessageWeek[]> {
  if (conversationIds.length === 0) return [];

  const { data, error } = await supabase.rpc('fetch_conversation_message_weeks', {
    p_conversation_ids: conversationIds,
  });

  if (error) throw error;

  return (data || [])
    .map((week) => ({
      conversationId: week.conversation_id,
      weekStart: week.week_start,
      messageCount: Number(week.message_count),
    }))
    .sort((a, b) =>
      a.conversationId.localeCompare(b.conversationId) ||
      a.weekStart.localeCompare(b.weekStart)
    );
}

export async function fetchConversationWeekMessages(
  conversationId: string,
  weekStart: string
): Promise<UIMessage[]> {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const pageSize = 1000;
  const messages: DBMessage[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .gte('sent_at', start.toISOString())
      .lt('sent_at', end.toISOString())
      .order('sent_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    messages.push(...((data || []) as DBMessage[]));
    if ((data || []).length < pageSize) break;
  }

  return messages.map(transformDBToUIMessage);
}

export async function fetchAllConversationMessages(
  conversationId: string
): Promise<UIMessage[]> {
  const pageSize = 1000;
  const messages: DBMessage[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    messages.push(...((data || []) as DBMessage[]));
    if ((data || []).length < pageSize) break;
  }

  return messages.map(transformDBToUIMessage);
}

export function getConversationWeekStart(dateValue: string): string {
  const date = new Date(dateValue);
  const day = date.getUTCDay();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function isConversationWeekWithinLastSevenDays(
  weekStart: string,
  now = new Date()
): boolean {
  const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 7);
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - 7);

  return weekStartDate < now && weekEndDate > cutoff;
}

export function formatConversationWeek(weekStart: string): string {
  const start = new Date(`${weekStart}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return `Semana de ${formatter.format(start)} a ${formatter.format(end)}`;
}
