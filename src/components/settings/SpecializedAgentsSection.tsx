import React, { useState, useEffect } from 'react';
import { Bot, Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, Lock } from 'lucide-react';
import { Button } from '../Button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import AgentConfigModal from '@/components/agents/AgentConfigModal';

interface AgentConfig {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  trigger_type: string;
  trigger_queue_id: string | null;
  trigger_campaign_id: string | null;
  model_mode: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  queue?: { name: string; color: string } | null;
  campaign?: { name: string } | null;
}

const TRIGGER_BADGE: Record<string, { label: string; color: string }> = {
  default:  { label: 'Padrão Global', color: 'bg-slate-700 text-slate-300' },
  queue:    { label: 'Por Fila',      color: 'bg-violet-500/20 text-violet-300 border border-violet-500/30' },
  campaign: { label: 'Por Campanha',  color: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' },
};

const MODEL_ICON: Record<string, string> = {
  flash: '⚡', pro: '🧠', pro3: '🚀', adaptive: '🎯',
};

// Um só lugar para todos os agentes de IA: o Padrão (sempre existe,
// não pode ser excluído) e os roteados por Fila/Campanha, que têm
// prioridade sobre ele quando casam com a conversa (campanha > fila > padrão).
const SpecializedAgentsSection: React.FC = () => {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agent_configs')
        .select('*, queue:queues(name, color), campaign:recurring_campaigns(name)')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAgents((data ?? []) as unknown as AgentConfig[]);
    } catch {
      toast.error('Erro ao carregar agentes');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (agent: AgentConfig) => {
    try {
      const { error } = await supabase
        .from('agent_configs')
        .update({ is_active: !agent.is_active })
        .eq('id', agent.id);
      if (error) throw error;
      setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, is_active: !a.is_active } : a));
      toast.success(agent.is_active ? 'Agente desativado' : 'Agente ativado');
    } catch {
      toast.error('Erro ao alterar status do agente');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return;
    try {
      const { error } = await supabase.from('agent_configs').delete().eq('id', id);
      if (error) throw error;
      setAgents(prev => prev.filter(a => a.id !== id));
      toast.success('Agente excluído');
    } catch {
      toast.error('Erro ao excluir agente');
    }
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setModalOpen(true);
  };

  const handleNew = () => {
    setEditingId(null);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) setEditingId(null);
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bot className="w-5 h-5 text-cyan-400" />
          <div>
            <h3 className="font-semibold text-white">Agentes de IA</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Prompt, modelo e comportamento por fila ou campanha — cada atendimento usa o agente que melhor casar.
            </p>
          </div>
        </div>
        <Button onClick={handleNew} size="sm" className="shadow-lg shadow-cyan-500/20">
          <Plus className="w-4 h-4 mr-2" />
          Novo Agente
        </Button>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 mb-4">
        <p className="text-xs text-slate-400 mb-2 font-medium">Ordem de prioridade (maior ganha):</p>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">Campanha (100)</span>
          <span className="text-slate-600">›</span>
          <span className="px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">Fila (50)</span>
          <span className="text-slate-600">›</span>
          <span className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">Padrão Global (0)</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map(agent => {
            const badge = TRIGGER_BADGE[agent.trigger_type] ?? TRIGGER_BADGE.default;
            const isDefault = agent.trigger_type === 'default';
            return (
              <div
                key={agent.id}
                className={`rounded-xl border p-4 flex items-start gap-4 transition-all ${
                  agent.is_active
                    ? 'border-slate-700 bg-slate-900/50'
                    : 'border-slate-800 bg-slate-900/20 opacity-60'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-xl flex-shrink-0">
                  {agent.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">{agent.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                    {agent.queue && (
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ backgroundColor: `${agent.queue.color}20`, color: agent.queue.color, border: `1px solid ${agent.queue.color}50` }}
                      >
                        {agent.queue.name}
                      </span>
                    )}
                    {agent.campaign && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-400">
                        {agent.campaign.name}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-500">
                      {MODEL_ICON[agent.model_mode]} {agent.model_mode}
                    </span>
                  </div>
                  {agent.description && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{agent.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleActive(agent)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    title={agent.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {agent.is_active
                      ? <ToggleRight className="w-5 h-5 text-cyan-400" />
                      : <ToggleLeft className="w-5 h-5" />
                    }
                  </button>
                  <button
                    onClick={() => handleEdit(agent.id)}
                    className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {isDefault ? (
                    <span className="p-2 text-slate-600" title="O agente Padrão não pode ser excluído">
                      <Lock className="w-4 h-4" />
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDelete(agent.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AgentConfigModal
        open={modalOpen}
        onOpenChange={handleModalClose}
        agentId={editingId}
        onSaved={loadAgents}
      />
    </div>
  );
};

export default SpecializedAgentsSection;
