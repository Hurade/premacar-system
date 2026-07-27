import React from 'react';
import { X, History, Loader2, MessageSquare } from 'lucide-react';
import { useContactHistory } from '@/hooks/useContactHistory';
import { HistorySessionBlock } from '../chat/HistorySessionBlock';

interface ContactHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string | null;
  contactName: string | null;
}

export function ContactHistoryModal({ isOpen, onClose, contactId, contactName }: ContactHistoryModalProps) {
  const { sessions, totalMessages, isLoading } = useContactHistory(contactId || undefined, {
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <History className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Histórico de Conversas</h2>
              {contactName && <p className="text-xs text-slate-500">{contactName}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Nenhum histórico de conversas para este contato.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {sessions.length} {sessions.length === 1 ? 'conversa' : 'conversas'} · {totalMessages} {totalMessages === 1 ? 'mensagem' : 'mensagens'}
              </p>
              {sessions.map((session) => (
                <HistorySessionBlock key={session.conversationId} session={session} />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
