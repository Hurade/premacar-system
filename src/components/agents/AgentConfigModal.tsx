import React, { useState, useEffect } from 'react';
import { Bot, Wand2, Loader2, Info, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/services/api';
import { useRecurringCampaigns } from '@/hooks/useRecurringCampaigns';
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
import PromptGeneratorSheet from '@/components/settings/PromptGeneratorSheet';
import { DEFAULT_NINA_PROMPT } from '@/prompts/default-nina-prompt';

type TriggerType = 'default' | 'queue' | 'campaign';
type ModelMode = 'flash' | 'pro' | 'pro3' | 'adaptive';

interface AgentConfig {
  id?: string;
  name: string;
  description: string | null;
  icon: string | null;
  trigger_type: TriggerType;
  trigger_queue_id: string | null;
  trigger_campaign_id: string | null;
  system_prompt: string;
  model_mode: ModelMode;
  message_breaking_enabled: boolean;
  ai_activation_delay_minutes: number;
  priority: number;
  is_active: boolean;
}

const DEFAULT_CONFIG: AgentConfig = {
  name: '',
  description: '',
  icon: '🤖',
  trigger_type: 'queue',
  trigger_queue_id: null,
  trigger_campaign_id: null,
  system_prompt: '',
  model_mode: 'flash',
  message_breaking_enabled: true,
  ai_activation_delay_minutes: 5,
  priority: 50,
  is_active: true,
};

const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  default: 'Padrão Global',
  queue: 'Fila de Atendimento',
  campaign: 'Campanha Específica',
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
  const [queues, setQueues] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const { campaigns } = useRecurringCampaigns({});

  useEffect(() => {
    if (open) {
      api.fetchQueues().then((data: any) => setQueues(data)).catch(() => {});
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
        trigger_type: data.trigger_type as TriggerType,
        model_mode: data.model_mode as ModelMode,
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
    if (config.trigger_type === 'queue' && !config.trigger_queue_id) { toast.error('Selecione uma fila'); return; }
    if (config.trigger_type === 'campaign' && !config.trigger_campaign_id) { toast.error('Selecione uma campanha'); return; }

    setSaving(true);
    try {
      const payload = {
        name: config.name,
        description: config.description,
        icon: config.icon,
        trigger_type: config.trigger_type,
        trigger_queue_id: config.trigger_type === 'queue' ? config.trigger_queue_id : null,
        trigger_campaign_id: config.trigger_type === 'campaign' ? config.trigger_campaign_id : null,
        system_prompt: config.system_prompt,
        model_mode: config.model_mode,
        message_breaking_enabled: config.message_breaking_enabled,
        ai_activation_delay_minutes: config.ai_activation_delay_minutes,
        priority: config.trigger_type === 'campaign' ? 100 : config.trigger_type === 'queue' ? 50 : 0,
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

  const handlePromptGenerated = (prompt: string) => {
    setConfig(prev => ({ ...prev, system_prompt: prompt }));
  };

  const handleRestoreDefault = () => {
    setConfig(prev => ({ ...prev, system_prompt: DEFAULT_NINA_PROMPT }));
    toast.success('Prompt restaurado para o padrão');
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

        <PromptGeneratorSheet
          open={isGeneratorOpen}
          onOpenChange={setIsGeneratorOpen}
          onPromptGenerated={handlePromptGenerated}
        />

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
                  placeholder="ex: Suporte, Comercial, Financeiro"
                  disabled={config.trigger_type === 'default'}
                  className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-60"
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

              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(TRIGGER_TYPE_LABELS) as [TriggerType, string][])
                  .filter(([type]) => type !== 'default' || config.trigger_type === 'default')
                  .map(([type, label]) => (
                    <button
                      key={type}
                      type="button"
                      disabled={type === 'default'}
                      onClick={() => setConfig(prev => ({ ...prev, trigger_type: type }))}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left disabled:cursor-not-allowed ${
                        config.trigger_type === type
                          ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
              </div>

              {config.trigger_type === 'queue' && (
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Fila</label>
                  <select
                    value={config.trigger_queue_id ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, trigger_queue_id: e.target.value || null }))}
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    <option value="">Selecione uma fila...</option>
                    {queues.map(q => (
                      <option key={q.id} value={q.id}>{q.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {config.trigger_type === 'campaign' && (
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Campanha recorrente</label>
                  <select
                    value={config.trigger_campaign_id ?? ''}
                    onChange={e => setConfig(prev => ({ ...prev, trigger_campaign_id: e.target.value || null }))}
                    className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                  >
                    <option value="">Selecione uma campanha...</option>
                    {(campaigns ?? []).map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {config.trigger_type === 'default' && (
                <p className="text-xs text-amber-400">
                  Este é o agente Padrão — usado quando nenhuma fila ou campanha específica casar com a conversa. Não pode ser excluído nem trocado de gatilho.
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
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={handleRestoreDefault} className="text-slate-400 hover:text-white text-xs">
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Restaurar Padrão
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setIsGeneratorOpen(true)} className="text-cyan-400 hover:text-cyan-300 text-xs">
                    <Wand2 className="w-3 h-3 mr-1" />
                    Gerar com IA
                  </Button>
                </div>
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
                  onChange={e => setConfig(prev => ({ ...prev, ai_activation_delay_minutes: parseFloat(e.target.value) }))}
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                >
                  <option value={0}>Sem delay</option>
                  <option value={0.33}>20 segundos</option>
                  <option value={0.5}>30 segundos</option>
                  <option value={1}>1 minuto</option>
                  <option value={2}>2 minutos</option>
                  <option value={5}>5 minutos (rec.)</option>
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos</option>
                  <option value={30}>30 minutos</option>
                </select>
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

            {/* Status */}
            {config.trigger_type !== 'default' && (
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
            )}

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
