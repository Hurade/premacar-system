import React from 'react';
import { Layers, Share2, User, Bot, Download } from 'lucide-react';
import { HistorySession } from '@/hooks/useContactHistory';
import { UIMessage, MessageDirection, MessageType } from '@/types';

function formatSessionDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderHistoryMessageContent(msg: UIMessage) {
  if (msg.type === MessageType.IMAGE) {
    return (
      <img
        src={msg.mediaUrl || msg.content}
        alt="Anexo"
        className="rounded-lg max-w-full h-auto max-h-56 object-cover border border-slate-700/50"
        loading="lazy"
      />
    );
  }

  if (msg.type === MessageType.AUDIO) {
    return msg.mediaUrl ? (
      <audio controls src={msg.mediaUrl} className="max-w-[240px] h-9" />
    ) : (
      <span className="italic text-slate-400">Áudio indisponível</span>
    );
  }

  if (msg.type === MessageType.VIDEO) {
    return msg.mediaUrl ? (
      <video controls src={msg.mediaUrl} className="rounded-lg max-w-full max-h-56 border border-slate-700/50" />
    ) : (
      <span className="italic text-slate-400">Vídeo indisponível</span>
    );
  }

  if (msg.type === MessageType.DOCUMENT) {
    const isLikelyFileName = !!msg.content && msg.content.length < 80 && /\.[a-z0-9]{2,5}$/i.test(msg.content);
    return msg.mediaUrl ? (
      <a
        href={msg.mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        download
        className="flex items-center gap-2 min-w-[180px] hover:opacity-90 transition-opacity"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span className="text-sm underline underline-offset-2 break-all">
          {isLikelyFileName ? msg.content : 'Abrir anexo'}
        </span>
      </a>
    ) : (
      <span className="italic text-slate-400">{isLikelyFileName ? msg.content : 'Anexo indisponível'}</span>
    );
  }

  return <span className="whitespace-pre-wrap break-words">{msg.content}</span>;
}

interface HistorySessionBlockProps {
  session: HistorySession;
  muted?: boolean;
}

export function HistorySessionBlock({ session, muted = false }: HistorySessionBlockProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg bg-slate-800/50 border border-slate-800 px-3 py-2 text-xs text-slate-400">
        <span className={`px-2 py-0.5 rounded-full font-medium ${session.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/50 text-slate-400'}`}>
          {session.isActive ? 'Ativo' : 'Encerrado'}
        </span>
        {session.queueName && (
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            {session.queueName}
          </span>
        )}
        {session.connectionName && (
          <span className="flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5" />
            {session.connectionName}
          </span>
        )}
        {session.attendantName && (
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {session.attendantName}
          </span>
        )}
        {session.protocolNumber && <span>Protocolo {session.protocolNumber}</span>}
        <span className="ml-auto">
          {formatSessionDate(session.startedAt)} — {formatSessionDate(session.lastMessageAt)}
        </span>
      </div>

      {session.messages.length === 0 ? (
        <p className="text-xs text-slate-500 italic px-1">Sem mensagens nesta conversa.</p>
      ) : (
        <div className="space-y-3 px-1">
          {session.messages.map((msg) => {
            const isOutgoing = msg.direction === MessageDirection.OUTGOING;
            return (
              <div key={msg.id} className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col max-w-[75%] ${isOutgoing ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`px-4 py-2 rounded-2xl text-sm leading-relaxed ${muted ? 'opacity-70' : 'opacity-90'} ${
                      isOutgoing
                        ? msg.fromType === 'nina'
                          ? 'bg-violet-700/60 text-white rounded-tr-sm'
                          : 'bg-cyan-700/60 text-white rounded-tr-sm'
                        : 'bg-slate-800 text-slate-300 rounded-tl-sm border border-slate-700/50'
                    }`}
                  >
                    {renderHistoryMessageContent(msg)}
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1">
                    {isOutgoing && msg.fromType === 'nina' && <Bot className="w-3 h-3 text-violet-400" />}
                    {isOutgoing && msg.fromType === 'human' && <User className="w-3 h-3 text-cyan-400" />}
                    <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
