import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  useSaveAutomationRule,
  type AutomationRule,
  type AutomationTriggerType,
  type AutomationCondition,
  type AutomationAction,
  type ConditionOperator,
} from '@/hooks/useAutomationRules';

interface AutomationRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rule: AutomationRule | null;
  onSaved: () => void;
}

const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  new_message: 'Nova mensagem recebida',
  tag_applied: 'Tag aplicada a um contato',
  stage_changed: 'Mudança de estágio no pipeline',
};

const CONDITION_FIELDS = [
  { value: 'contact.tags', label: 'Tags do contato' },
  { value: 'contact.name', label: 'Nome do contato' },
  { value: 'message.content', label: 'Conteúdo da mensagem' },
  { value: 'deal.value', label: 'Valor do negócio' },
  { value: 'deal.stage_id', label: 'Estágio do negócio' },
];

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'é igual a',
  not_equals: 'é diferente de',
  contains: 'contém',
  not_contains: 'não contém',
  greater_than: 'maior que',
  less_than: 'menor que',
  is_empty: 'está vazio',
};

const ACTION_LABELS: Record<AutomationAction['type'], string> = {
  send_message: 'Enviar mensagem',
  apply_tag: 'Aplicar tag',
  remove_tag: 'Remover tag',
  move_stage: 'Mover para estágio',
  create_task: 'Criar tarefa',
};

const emptyRule = (): Partial<AutomationRule> => ({
  name: '',
  description: '',
  is_active: true,
  trigger_type: 'new_message',
  trigger_config: {},
  conditions: [],
  conditions_logic: 'AND',
  actions: [],
  priority: 0,
  run_once_per_contact: false,
});

export function AutomationRuleModal({ open, onOpenChange, rule, onSaved }: AutomationRuleModalProps) {
  const [form, setForm] = useState<Partial<AutomationRule>>(emptyRule());
  const [stages, setStages] = useState<{ id: string; title: string }[]>([]);
  const saveMutation = useSaveAutomationRule();

  useEffect(() => {
    if (open) {
      setForm(rule ? { ...rule } : emptyRule());
      supabase
        .from('pipeline_stages')
        .select('id, title')
        .order('position')
        .then(({ data }) => setStages(data || []));
    }
  }, [open, rule]);

  const conditions = form.conditions || [];
  const actions = form.actions || [];

  const updateTriggerConfig = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, trigger_config: { ...(prev.trigger_config || {}), [key]: value } }));
  };

  const addCondition = () => {
    const next: AutomationCondition = { field: CONDITION_FIELDS[0].value, operator: 'equals', value: '' };
    setForm((prev) => ({ ...prev, conditions: [...(prev.conditions || []), next] }));
  };

  const updateCondition = (index: number, patch: Partial<AutomationCondition>) => {
    setForm((prev) => {
      const next = [...(prev.conditions || [])];
      next[index] = { ...next[index], ...patch };
      return { ...prev, conditions: next };
    });
  };

  const removeCondition = (index: number) => {
    setForm((prev) => ({ ...prev, conditions: (prev.conditions || []).filter((_, i) => i !== index) }));
  };

  const addAction = () => {
    const next: AutomationAction = { type: 'send_message', params: {} };
    setForm((prev) => ({ ...prev, actions: [...(prev.actions || []), next] }));
  };

  const updateAction = (index: number, patch: Partial<AutomationAction>) => {
    setForm((prev) => {
      const next = [...(prev.actions || [])];
      next[index] = { ...next[index], ...patch };
      return { ...prev, actions: next };
    });
  };

  const updateActionParam = (index: number, key: string, value: string) => {
    setForm((prev) => {
      const next = [...(prev.actions || [])];
      next[index] = { ...next[index], params: { ...next[index].params, [key]: value } };
      return { ...prev, actions: next };
    });
  };

  const removeAction = (index: number) => {
    setForm((prev) => ({ ...prev, actions: (prev.actions || []).filter((_, i) => i !== index) }));
  };

  const handleSave = () => {
    if (!form.name?.trim()) return;
    saveMutation.mutate(form, {
      onSuccess: () => {
        onSaved();
        onOpenChange(false);
      },
    });
  };

  const inputClass = 'w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar Automação' : 'Nova Automação'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Nome</label>
            <input
              className={inputClass}
              value={form.name || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Tag quente dispara mensagem"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Descrição (opcional)</label>
            <input
              className={inputClass}
              value={form.description || ''}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Gatilho */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-400">Quando (gatilho)</label>
            <select
              className={inputClass}
              value={form.trigger_type}
              onChange={(e) => setForm((prev) => ({ ...prev, trigger_type: e.target.value as AutomationTriggerType, trigger_config: {} }))}
            >
              {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {form.trigger_type === 'tag_applied' && (
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Só disparar quando a tag aplicada for (deixe vazio para qualquer tag)</label>
              <input
                className={inputClass}
                value={form.trigger_config?.tag || ''}
                onChange={(e) => updateTriggerConfig('tag', e.target.value)}
                placeholder="ex: quente"
              />
            </div>
          )}

          {form.trigger_type === 'stage_changed' && (
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Só disparar quando mover para o estágio (deixe vazio para qualquer estágio)</label>
              <select
                className={inputClass}
                value={form.trigger_config?.to_stage_id || ''}
                onChange={(e) => updateTriggerConfig('to_stage_id', e.target.value)}
              >
                <option value="">Qualquer estágio</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Condições */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-slate-400">Se (condições, opcional)</label>
              {conditions.length > 1 && (
                <select
                  className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-xs text-slate-300"
                  value={form.conditions_logic}
                  onChange={(e) => setForm((prev) => ({ ...prev, conditions_logic: e.target.value as 'AND' | 'OR' }))}
                >
                  <option value="AND">Todas (AND)</option>
                  <option value="OR">Qualquer uma (OR)</option>
                </select>
              )}
            </div>
            {conditions.map((cond, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-300"
                  value={cond.field}
                  onChange={(e) => updateCondition(i, { field: e.target.value })}
                >
                  {CONDITION_FIELDS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <select
                  className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-300"
                  value={cond.operator}
                  onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionOperator })}
                >
                  {Object.entries(OPERATOR_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {cond.operator !== 'is_empty' && (
                  <input
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-300"
                    value={cond.value}
                    onChange={(e) => updateCondition(i, { value: e.target.value })}
                    placeholder="valor"
                  />
                )}
                <button onClick={() => removeCondition(i)} className="text-slate-500 hover:text-red-400">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button onClick={addCondition} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar condição
            </button>
          </div>

          {/* Ações */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Então (ações)</label>
            {actions.map((action, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <select
                    className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1.5 text-xs text-slate-300"
                    value={action.type}
                    onChange={(e) => updateAction(i, { type: e.target.value as AutomationAction['type'], params: {} })}
                  >
                    {Object.entries(ACTION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <button onClick={() => removeAction(i)} className="text-slate-500 hover:text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {(action.type === 'send_message') && (
                  <textarea
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 resize-none min-h-[60px]"
                    placeholder="Mensagem a enviar..."
                    value={action.params.message || ''}
                    onChange={(e) => updateActionParam(i, 'message', e.target.value)}
                  />
                )}

                {(action.type === 'apply_tag' || action.type === 'remove_tag') && (
                  <input
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200"
                    placeholder="Nome da tag"
                    value={action.params.tag || ''}
                    onChange={(e) => updateActionParam(i, 'tag', e.target.value)}
                  />
                )}

                {action.type === 'move_stage' && (
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200"
                    value={action.params.stage_id || ''}
                    onChange={(e) => updateActionParam(i, 'stage_id', e.target.value)}
                  >
                    <option value="">Selecione o estágio...</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                    ))}
                  </select>
                )}

                {action.type === 'create_task' && (
                  <>
                    <input
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200"
                      placeholder="Título da tarefa"
                      value={action.params.title || ''}
                      onChange={(e) => updateActionParam(i, 'title', e.target.value)}
                    />
                    <textarea
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-200 resize-none min-h-[50px]"
                      placeholder="Descrição (opcional)"
                      value={action.params.description || ''}
                      onChange={(e) => updateActionParam(i, 'description', e.target.value)}
                    />
                  </>
                )}
              </div>
            ))}
            <button onClick={addAction} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Adicionar ação
            </button>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <input
                type="checkbox"
                checked={form.run_once_per_contact || false}
                onChange={(e) => setForm((prev) => ({ ...prev, run_once_per_contact: e.target.checked }))}
                className="rounded border-slate-700"
              />
              Rodar só uma vez por contato
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Prioridade
              <input
                type="number"
                className="w-16 bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-xs text-slate-200"
                value={form.priority ?? 0}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending || !form.name?.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
