import { ReactNode, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { UIMessage } from '@/types';
import {
  ConversationMessageWeek,
  fetchConversationWeekMessages,
  formatConversationWeek,
} from '@/lib/conversationMessageWeeks';

interface WeeklyMessageBlockProps {
  conversationId: string;
  week: ConversationMessageWeek;
  defaultOpen?: boolean;
  muted?: boolean;
  supplementalMessages?: UIMessage[];
  children: (messages: UIMessage[]) => ReactNode;
}

export function WeeklyMessageBlock({
  conversationId,
  week,
  defaultOpen = false,
  muted = false,
  supplementalMessages = [],
  children,
}: WeeklyMessageBlockProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const query = useQuery({
    queryKey: ['conversation-week-messages', conversationId, week.weekStart],
    queryFn: () => fetchConversationWeekMessages(conversationId, week.weekStart),
    enabled: isOpen,
    staleTime: 30_000,
    retry: 1,
  });

  const messages = useMemo(() => {
    const byId = new Map((query.data || []).map((message) => [message.id, message]));
    supplementalMessages.forEach((message) => byId.set(message.id, message));
    return [...byId.values()].sort(
      (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
    );
  }, [query.data, supplementalMessages]);

  return (
    <section className="space-y-3">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border text-left transition-colors ${
          muted
            ? 'bg-slate-900/50 border-slate-800 text-slate-400 hover:bg-slate-800/70'
            : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
        }`}
      >
        <span className="text-xs font-medium">
          {formatConversationWeek(week.weekStart)}
          <span className="ml-2 text-slate-500">
            {week.messageCount} {week.messageCount === 1 ? 'mensagem' : 'mensagens'}
          </span>
        </span>
        {isOpen ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
      </button>

      {isOpen && (
        <div className="space-y-3 px-1">
          {query.isLoading && messages.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando esta semana...
            </div>
          )}
          {query.isError && (
            <button
              type="button"
              onClick={() => query.refetch()}
              className="w-full py-3 text-xs text-rose-400 hover:text-rose-300"
            >
              Falha ao carregar as mensagens desta semana. Clique para tentar novamente.
            </button>
          )}
          {!query.isLoading && !query.isError && messages.length === 0 && (
            <p className="py-3 text-center text-xs text-slate-500">Sem mensagens nesta semana.</p>
          )}
          {messages.length > 0 && children(messages)}
        </div>
      )}
    </section>
  );
}
