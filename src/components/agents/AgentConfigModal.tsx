import React, { useState, useEffect } from 'react';
import { Bot, Wand2, Loader2, Info, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type TriggerType = 'default' | 'origin' | 'campaign' | 'event';
type TriggerOrigin = 'disparo' | 'inbound' | 'retorno';
type ModelMode = 'flash' | 'pro' | 'pro3' | 'adaptive';

interface AgentConfig {
  id?: string;
  name: string;
  description: string | null;
  icon: string | null;
  trigger_type: TriggerType;
  trigger_origin: TriggerOrigin | null;
  trigger_campaign_id: string | null;
  trigger_event: string | null;
  system_prompt: string;
  model_mode: ModelMode;
  max_messages_per_hour: number;
  response_delay_seconds: number;
  message_breaking_enabled: boolean;
  ai_activation_delay_minutes: number;
  handoff_keywords: string[];
  handoff_message: string | null;
  priority: number;
  is_active: boolean;
}

const DEFAULT_CONFIG: AgentConfig = {
  name: '',
  description: '',
  icon: '🤖',
  trigger_type: 'origin',
  trigger_origin: 'disparo',
  trigger_campaign_id: null,
  trigger_event: null,
  system_prompt: '',
  model_mode: 'flash',
  max_messages_per_hour: 10,
  response_delay_seconds: 30,
  message_breaking_enabled: true,
  ai_activation_delay_minutes: 5,
  handoff_keywords: [],
  handoff_message: 'Um momento, vou te conectar com nossa equipe! 😊',
  priority: 50,
  is_active: true,
};

const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  default: 'Padrão Global',
  origin: 'Origem da Conversa',
  campaign: 'Campanha Específica',
  event: 'Evento do Sistema',
};

const ORIGIN_LABELS: Record<TriggerOrigin, string> = {
  disparo: 'Disparo (campanha respondida)',
  inbound: 'Inbound (lead entrou em contato)',
  retorno: 'Retorno (já conversou antes)',
};

const MODEL_OPTIONS: { value: ModelMode; label: string; icon: string; desc: string }[] = [
  { value: 'flash', icon: '⚡', label: 'Flash', desc: 'Rápido e econômico' },
  { value: 'pro', icon: '🧠', label: 'Pro 2.5', desc: 'Mais inteligente' },
  { value: 'pro3', icon: '🚀', label: 'Pro 3', desc: 'Mais recente' },
  { value: 'adaptive', icon: '🎯', label: 'Adaptativo', desc: 'Por contexto' },
];

const DYNAMIC_VARIABLES = [
  { var: '{{ data_hora }}', desc: 'Data e hora atual' },
  { var: '{{ cliente_nome }}', desc: 'Nome do lead' },
  { var: '{{ cliente_tags }}', desc: 'Tags do contato' },
  { var: '{{ cliente_notas }}', desc: 'Observações do contato' },
  { var: '{{ origem_conversa }}', desc: 'disparo | inbound | retorno' },
  { var: '{{ historico_conversa }}', desc: 'true se já conversou antes' },
  { var: '{{ deal_estagio }}', desc: 'Estágio atual no pipeline' },
  { var: '{{ empresa_nome }}', desc: 'Nome da empresa (configurações)' },
  { var: '{{ agente_nome }}', desc: 'Nome do SDR configurado' },
];

interface AgentConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId?: string | null;
  onSaved: () => void;
}

const AgentConfigModal: React.FC<AgentConfigModalProps> = ({
  open,
  onOpenChange,
  agentId,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [keywordInput, setKeywordInput] = useState('');

  useEffect(() => {
    if (open) {
      if (agentId) {
        loadAgent(agentId);
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    }
  }, [open, agentId]);

  const loadAgent = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      setConfig({
        ...data,
        trigger_origin: data.trigger_origin as TriggerOrigin | null,
        trigger_type: data.trigger_type as TriggerType,
        model_mode: data.model_mode as ModelMode,
        handoff_keywords: data.handoff_keywords ?? [],
      });
    } catch {
      toast.error('Erro ao carregar agente');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.name.trim()) { toast.error('Nome do agente é obrigatório'); return; }
    if (!config.system_prompt.trim()) { toast.error('Prompt do agente é obrigatório'); return; }

    setSaving(true);
    try {
      const payload = {
        name: config.name,
        description: config.description,
        icon: config.icon,
        trigger_type: config.trigger_type,
        trigger_origin: config.trigger_type === 'origin' ? config.trigger_origin : null,
        trigger_campaign_id: config.trigger_type === 'campaign' ? config.trigger_campaign_id : null,
        trigger_event: config.trigger_type === 'event' ? config.trigger_event : null,
        system_prompt: config.system_prompt,
        model_mode: config.model_mode,
        max_messages_per_hour: config.max_messages_per_hour,
        response_delay_seconds: config.response_delay_seconds,
        message_breaking_enabled: config.message_breaking_enabled,
        ai_activation_delay_minutes: config.ai_activation_delay_minutes,
        handoff_keywords: config.handoff_keywords,
        handoff_message: config.handoff_message,
        priority: config.trigger_type === 'campaign' ? 100 : config.trigger_type === 'origin' ? 50 : 0,
        is_active: config.is_active,
      };

      if (agentId) {
        const { error } = await supabase.from('agent_configs').update(payload).eq('id', agentId);
        if (error) throw error;
        toast.success('Agente atualizado!');
      } else {
        const { error } = await supabase.from('agent_configs').insert(payload);
        if (error) throw error;
        toast.success('Agente criado!');
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar agente');
    } finally {
      setSaving(false);
    }
  };

  const addKeyword = () => {
    const kw = keywordInput.trim().toLowerCase();
    if (kw && !config.handoff_keywords.includes(kw)) {
      setConfig(prev => ({ ...prev, handoff_keywords: [...prev.handoff_keywords, kw] }));
    }
    setKeywordInput('');
  };

  const removeKeyword = (kw: string) => {
    setConfig(prev => ({ ...prev, handoff_keywords: prev.handoff_keywords.filter(k => k !== kw) }));
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-slate-900 border-slate-800">
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bot className="w-5 h-5 text-cyan-400" />
            {agentId ? 'Editar Agente' : 'Novo Agente de IA'}
          </DialogTitle>
        </DialogHeader>

        <TooltipProvider>
          <div className="space-y-6 mt-2">

            {/* Identidade */}
            <div className="grid grid-cols-[80px_1fr] gap-3">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Ícone</label>
                <input
                  type="text"
                  value={config.icon ?? ''}
                  onChange={e => setConfig(prev => ({ ...prev, icon: e.target.value }))}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xl text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Nome do Agente <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={config.name}
                  onChange={e => setConfig(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ex: Cris Reativação — Disparo"
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">Descrição</label>
              <input
                type="text"
                value={config.description ?? ''}
                onChange={e => setConfig(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Quando e para que usar este agente"
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>

            {/* Gatilho */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-violet-400">Quando usar este agente</h3>

              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(TRIGGER_TYPE_LABELS) as [TriggerType, string][]).map(([type, label]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, trigger_type: type }))}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${
                      config.trigger_type === type
                        ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {config.trigger_type === 'origin' && (
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Origem da conversa</label>
                  <select
                    value={config.trigger_origin ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, trigger_origin: e.target.value as TriggerOrigin }))}
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    {(Object.entries(ORIGIN_LABELS) as [TriggerOrigin, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              )}

              {config.trigger_type === 'event' && (
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Evento</label>
                  <input
                    type="text"
                    value={config.trigger_event ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, trigger_event: e.target.value }))}
                    placeholder="ex: post_service, review_due"
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  />
                </div>
              )}

              {config.trigger_type === 'default' && (
                <p className="text-xs text-amber-400">
                  Este agente será o fallback global quando nenhum outro agente se encaixar.
                </p>
              )}
            </div>

            {/* Prompt */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Prompt do Agente <span className="text-red-400">*</span>
                </h3>
                <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 text-xs">
                  <Wand2 className="w-3 h-3 mr-1" />
                  Gerar com IA
                </Button>
              </div>
              <textarea
                value={config.system_prompt}
                onChange={e => setConfig(prev => ({ ...prev, system_prompt: e.target.value }))}
                placeholder="Descreva o papel, objetivo, tom e comportamento deste agente..."
                rows={10}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 resize-y font-mono"
              />
              <details>
                <summary className="text-xs text-cyan-400 cursor-pointer hover:text-cyan-300 flex items-center gap-1">
                  📋 Variáveis dinâmicas disponíveis
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-1 p-3 rounded-lg bg-slate-950 border border-slate-800">
                  {DYNAMIC_VARIABLES.map(({ var: v, desc }) => (
                    <div key={v} className="text-xs">
                      <span className="text-cyan-400 font-mono">{v}</span>
                      <span className="text-slate-500"> → {desc}</span>
                    </div>
                  ))}
                </div>
              </details>
            </div>

            {/* Modelo e Comportamento */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300">Modelo e Comportamento</h3>

              <div className="grid grid-cols-4 gap-2">
                {MODEL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setConfig(prev => ({ ...prev, model_mode: opt.value }))}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border transition-all ${
                      config.model_mode === opt.value
                        ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <span className="text-xs font-medium">{opt.label}</span>
                    <span className="text-[10px] opacity-70 text-center">{opt.desc}</span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block flex items-center gap-1">
                    Delay pós-disparo
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3 h-3 text-slate-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-[200px]">Tempo que a IA aguarda antes de responder após um disparo, para evitar responder outros bots.</p>
                      </TooltipContent>
                    </Tooltip>
                  </label>
                  <select
                    value={config.ai_activation_delay_minutes}
                    onChange={e => setConfig(prev => ({ ...prev, ai_activation_delay_minutes: parseInt(e.target.value) }))}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  >
                    <option value={0}>Sem delay</option>
                    <option value={2}>2 minutos</option>
                    <option value={5}>5 minutos (rec.)</option>
                    <option value={10}>10 minutos</option>
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Máx. msgs/hora</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={config.max_messages_per_hour}
                    onChange={e => setConfig(prev => ({ ...prev, max_messages_per_hour: parseInt(e.target.value) }))}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
                <span className="text-sm text-slate-300">Quebrar mensagens longas</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.message_breaking_enabled}
                    onChange={e => setConfig(prev => ({ ...prev, message_breaking_enabled: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
                </label>
              </div>
            </div>

            {/* Handoff */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-amber-400">Transferência para Humano</h3>
              <p className="text-xs text-slate-500">Palavras-chave que, quando detectadas, pausam a IA e notificam a equipe.</p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={keywordInput}
                  onChange={e => setKeywordInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                  placeholder="ex: preço, contrato, urgente"
                  className="flex-1 h-9 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <Button onClick={addKeyword} variant="ghost" size="sm" className="text-amber-400 hover:text-amber-300 border border-slate-700">
                  Adicionar
                </Button>
              </div>

              {config.handoff_keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {config.handoff_keywords.map(kw => (
                    <span key={kw} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="hover:text-red-400 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">Mensagem ao transferir</label>
                <input
                  type="text"
                  value={config.handoff_message ?? ''}
                  onChange={e => setConfig(prev => ({ ...prev, handoff_message: e.target.value }))}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
              <span className="text-sm text-slate-300">Agente ativo</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.is_active}
                  onChange={e => setConfig(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
              </label>
            </div>

            {/* Ações */}
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 border border-slate-700">
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="flex-1 shadow-lg shadow-cyan-500/20">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {agentId ? 'Salvar Alterações' : 'Criar Agente'}
              </Button>
            </div>

          </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
};

export default AgentConfigModal;
