import React, { useState } from 'react';
import { Zap, Plus, Pencil, Trash2, Loader2, ToggleLeft, ToggleRight, List, Workflow, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AutomationRuleModal } from '@/components/automations/AutomationRuleModal';
import FlowCanvas from '@/components/automations/FlowCanvas';
import {
  useAutomationRules,
  useToggleAutomationRule,
  useDeleteAutomationRule,
  useSaveAutomationRule,
  type AutomationRule,
  type AutomationAction,
} from '@/hooks/useAutomationRules';

const TRIGGER_BADGE: Record<string, { label: string; color: string }> = {
  new_message: { label: 'Nova mensagem', color: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' },
  tag_applied: { label: 'Tag aplicada', color: 'bg-violet-500/20 text-violet-300 border border-violet-500/30' },
  stage_changed: { label: 'Mudança de estágio', color: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' },
};

const Automacoes: React.FC = () => {
  const { data: rules, isLoading, refetch } = useAutomationRules();
  const toggleMutation = useToggleAutomationRule();
  const deleteMutation = useDeleteAutomationRule();
  const saveMutation = useSaveAutomationRule();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list');
  const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);

  const handleReorderActions = (rule: AutomationRule, newActions: AutomationAction[]) => {
    saveMutation.mutate({ id: rule.id, actions: newActions });
  };

  const handleNew = () => {
    setEditingRule(null);
    setModalOpen(true);
  };

  const handleEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setModalOpen(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Excluir a automação "${name}"?`)) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Zap className="w-7 h-7 text-cyan-400" />
            Automações
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Regras de gatilho → condição → ação para automatizar tarefas do CRM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'list' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Lista
            </button>
            <button
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'canvas' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              Canvas
            </button>
          </div>
          <Button onClick={handleNew} className="shadow-lg shadow-cyan-500/20">
            <Plus className="w-4 h-4 mr-2" />
            Nova Automação
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : !rules?.length ? (
        <div className="text-center py-16 text-slate-500">
          <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma automação criada ainda.</p>
          <Button onClick={handleNew} variant="ghost" className="mt-3 text-cyan-400 hover:text-cyan-300">
            Criar primeira automação
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const badge = TRIGGER_BADGE[rule.trigger_type];
            const isExpanded = expandedRuleId === rule.id;
            return (
              <div
                key={rule.id}
                className={`rounded-xl border p-4 transition-all ${
                  rule.is_active ? 'border-slate-700 bg-slate-900/50' : 'border-slate-800 bg-slate-900/20 opacity-60'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{rule.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.color}`}>{badge.label}</span>
                      <span className="text-[11px] text-slate-500">{rule.actions.length} ação(ões)</span>
                    </div>
                    {rule.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{rule.description}</p>}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {viewMode === 'canvas' && (
                      <button
                        onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                        title={isExpanded ? 'Ocultar canvas' : 'Ver canvas'}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      onClick={() => toggleMutation.mutate({ id: rule.id, is_active: !rule.is_active })}
                      className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      title={rule.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {rule.is_active ? <ToggleRight className="w-5 h-5 text-cyan-400" /> : <ToggleLeft className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleEdit(rule)}
                      className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id, rule.name)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {viewMode === 'canvas' && isExpanded && (
                  <div className="mt-4 pt-4 border-t border-slate-800">
                    <FlowCanvas rule={rule} onReorderActions={(newActions) => handleReorderActions(rule, newActions)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AutomationRuleModal open={modalOpen} onOpenChange={setModalOpen} rule={editingRule} onSaved={refetch} />
    </div>
  );
};

export default Automacoes;
