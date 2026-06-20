import { useState, useCallback } from 'react';
import { Bot, RefreshCw, Copy, ChevronRight, Lightbulb, MessageSquare, TrendingUp } from 'lucide-react';
import { UIMessage } from '@/types';
import { supabase } from '@/integrations/supabase/client';

interface CopilotAnalysis {
  context_summary: string;
  tone: string;
  tips: string[];
  suggested_reply: string;
  next_action: string;
}

interface AiCopilotPanelProps {
  messages: UIMessage[];
  contactName: string;
  onUseReply: (reply: string) => void;
}

export function AiCopilotPanel({ messages, contactName, onUseReply }: AiCopilotPanelProps) {
  const [analysis, setAnalysis] = useState<CopilotAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);

    const last15 = messages.slice(-15);
    const transcript = last15
      .filter(m => !m.isInternal)
      .map(m => {
        const who = m.fromType === 'user' ? contactName : 'Atendente';
        return `${who}: ${m.content}`;
      })
      .join('\n');

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-prompt', {
        body: { action: 'copilot-analyze', transcript, contactName }
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setAnalysis(data as CopilotAnalysis);
    } catch (err) {
      console.error('[AiCopilot] Error:', err);
      setError('Erro ao analisar conversa. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [messages, contactName]);

  return (
    <div className="flex flex-col h-full bg-[#111] border-l border-white/10">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-white">Copiloto IA</span>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Analisando...' : 'Analisar'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!analysis && !loading && !error && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
            <Bot className="w-10 h-10 text-purple-400/40" />
            <p className="text-sm text-white/40">
              Clique em <strong className="text-white/60">Analisar</strong> para receber dicas em tempo real sobre a conversa.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {analysis && (
          <>
            <div className="bg-white/5 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-white/50 mb-1">
                <MessageSquare className="w-3 h-3" />
                <span>Contexto</span>
              </div>
              <p className="text-sm text-white/80">{analysis.context_summary}</p>
              <span className="inline-block text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                Tom: {analysis.tone}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <Lightbulb className="w-3 h-3" />
                <span>Dicas</span>
              </div>
              {analysis.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg px-3 py-2">
                  <ChevronRight className="w-3 h-3 text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-white/70">{tip}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-white/50">
                <TrendingUp className="w-3 h-3" />
                <span>Resposta sugerida</span>
              </div>
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 space-y-2">
                <p className="text-sm text-white/80 italic">"{analysis.suggested_reply}"</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => onUseReply(analysis.suggested_reply)}
                    className="flex-1 text-xs bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Usar esta resposta
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(analysis.suggested_reply)}
                    className="text-xs bg-white/10 hover:bg-white/15 text-white/70 px-2 py-1.5 rounded-lg transition-colors"
                    title="Copiar"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <p className="text-xs text-white/50 mb-0.5">Próxima ação</p>
              <p className="text-sm text-green-300">{analysis.next_action}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
