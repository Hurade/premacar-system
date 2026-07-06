import React, { useState } from 'react';
import { Phone, PhoneCall, Loader2 } from 'lucide-react';
import { useVoiceCalls } from '@/hooks/useVoiceCalls';

interface VoiceCallsPanelProps {
  contactId: string;
}

const STATUS_LABELS: Record<string, string> = {
  initiated: 'Iniciada',
  queued: 'Na fila',
  ringing: 'Chamando',
  'in-progress': 'Em andamento',
  completed: 'Concluída',
  busy: 'Ocupado',
  failed: 'Falhou',
  'no-answer': 'Não atendeu',
  canceled: 'Cancelada',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'text-emerald-400 bg-emerald-500/10',
  failed: 'text-red-400 bg-red-500/10',
  busy: 'text-amber-400 bg-amber-500/10',
  'no-answer': 'text-amber-400 bg-amber-500/10',
  canceled: 'text-slate-400 bg-slate-500/10',
};

export function VoiceCallsPanel({ contactId }: VoiceCallsPanelProps) {
  const { calls, loading, hasActiveCall, startCall } = useVoiceCalls(contactId);
  const [starting, setStarting] = useState(false);

  const handleStartCall = async () => {
    if (!confirm('Iniciar uma ligação real para este contato agora? Isso gera custo no Twilio.')) return;
    setStarting(true);
    await startCall();
    setStarting(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Phone className="w-4 h-4" />
          Ligações
        </h4>
        <button
          onClick={handleStartCall}
          disabled={hasActiveCall || starting}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-40 flex items-center gap-1.5 transition-colors"
        >
          {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneCall className="w-3.5 h-3.5" />}
          Ligar agora
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
        </div>
      ) : calls.length === 0 ? (
        <p className="text-xs text-slate-500">Nenhuma ligação registrada para este contato.</p>
      ) : (
        <div className="space-y-2">
          {calls.map((call) => (
            <div key={call.id} className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[call.status] || 'text-slate-400 bg-slate-700/50'}`}>
                    {STATUS_LABELS[call.status] || call.status}
                  </span>
                  <span className="text-[10px] text-slate-500">{call.call_type === 'manual' ? 'Manual' : 'Campanha'}</span>
                </div>
                {call.duration_seconds != null && (
                  <p className="text-[11px] text-slate-500 mt-1">{call.duration_seconds}s</p>
                )}
                {call.error_message && (
                  <p className="text-[11px] text-red-400 mt-1 truncate" title={call.error_message}>{call.error_message}</p>
                )}
              </div>
              <span className="text-[10px] text-slate-600 flex-shrink-0">
                {new Date(call.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
