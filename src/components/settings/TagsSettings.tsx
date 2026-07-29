import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, Loader2, Sparkles } from 'lucide-react';
import { Button } from '../Button';
import {
  useTagDefinitions,
  useCreateTagDefinition,
  useUpdateTagDefinition,
  useDeleteTagDefinition,
} from '@/hooks/useTagDefinitions';
import type { TagDefinition } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  status: 'Status',
  interest: 'Interesse',
  action: 'Ação Necessária',
  qualification: 'Qualificação',
  custom: 'Personalizado',
};

const TAG_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
];

const emptyForm = {
  label: '',
  color: TAG_COLORS[0],
  category: 'custom',
  has_action: false,
  ai_instruction: '',
};

type Form = typeof emptyForm;

const TagsSettings: React.FC = () => {
  const { data: tags, isLoading } = useTagDefinitions(false);
  const createMutation = useCreateTagDefinition();
  const updateMutation = useUpdateTagDefinition();
  const deleteMutation = useDeleteTagDefinition();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const resetForm = () => {
    setForm(emptyForm);
    setIsCreating(false);
    setEditingId(null);
  };

  const handleCreate = () => {
    if (!form.label.trim()) return;
    createMutation.mutate(
      { label: form.label, color: form.color, category: form.category },
      {
        onSuccess: (newTag) => {
          // Ação só faz sentido depois que a tag existe (precisa do id) —
          // se o usuário já preencheu a instrução no form de criação,
          // grava num segundo passo.
          if (form.has_action && form.ai_instruction.trim()) {
            updateMutation.mutate({ id: newTag.id, has_action: true, ai_instruction: form.ai_instruction.trim() });
          }
          resetForm();
        },
      }
    );
  };

  const startEdit = (tag: TagDefinition) => {
    setEditingId(tag.id);
    setForm({
      label: tag.label,
      color: tag.color,
      category: tag.category,
      has_action: tag.has_action,
      ai_instruction: tag.ai_instruction || '',
    });
  };

  const handleUpdate = (id: string) => {
    updateMutation.mutate(
      {
        id,
        label: form.label,
        color: form.color,
        category: form.category,
        has_action: form.has_action,
        ai_instruction: form.has_action ? form.ai_instruction.trim() : null,
      },
      { onSuccess: resetForm }
    );
  };

  const handleToggleAtivo = (id: string, isActive: boolean) => {
    updateMutation.mutate({ id, is_active: !isActive });
  };

  const handleDelete = (id: string, label: string) => {
    if (!confirm(`Excluir a tag "${label}"? Ela deixa de aparecer nas conversas/contatos que já a usam.`)) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Tags</h3>
        <p className="text-xs text-slate-500 mt-1">
          Tags usadas em conversas e contatos. Uma tag pode ter uma ação: uma instrução que é
          injetada no contexto da IA sempre que o contato tiver essa tag (ex: a tag "Cliente" pode
          instruir a IA a não perguntar de novo se a pessoa já é cliente).
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {isCreating ? (
            <TagForm
              form={form}
              setForm={setForm}
              onSave={handleCreate}
              onCancel={resetForm}
              saving={createMutation.isPending}
            />
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full bg-slate-800/30 border border-dashed border-slate-700 rounded-lg p-4 text-slate-400 hover:text-white hover:border-slate-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Tag
            </button>
          )}

          {(tags || []).map((tag) =>
            editingId === tag.id ? (
              <TagForm
                key={tag.id}
                form={form}
                setForm={setForm}
                onSave={() => handleUpdate(tag.id)}
                onCancel={resetForm}
                saving={updateMutation.isPending}
              />
            ) : (
              <div key={tag.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white flex items-center gap-2 flex-wrap">
                      {tag.label}
                      {!tag.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Inativa</span>}
                      {tag.has_action && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Tem ação
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">
                      {CATEGORY_LABELS[tag.category] || tag.category}
                      {tag.has_action && tag.ai_instruction && (
                        <span className="block truncate text-slate-500 mt-0.5" title={tag.ai_instruction}>
                          "{tag.ai_instruction}"
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleAtivo(tag.id, tag.is_active)}
                    className="text-xs text-slate-400 hover:text-white transition-colors px-2"
                    title={tag.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {tag.is_active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => startEdit(tag)} className="p-2 text-slate-400 hover:text-white transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(tag.id, tag.label)} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          )}

          {!isLoading && (tags?.length ?? 0) === 0 && !isCreating && (
            <p className="text-xs text-slate-500 text-center py-4">Nenhuma tag criada ainda.</p>
          )}
        </div>
      )}
    </div>
  );
};

function TagForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
}: {
  form: Form;
  setForm: React.Dispatch<React.SetStateAction<Form>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      <input
        type="text"
        placeholder="Nome da tag (ex: Cliente)"
        value={form.label}
        onChange={(e) => setForm({ ...form, label: e.target.value })}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
      />

      <div className="flex items-center gap-1.5">
        {TAG_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => setForm({ ...form, color })}
            className={`w-6 h-6 rounded-full transition-all ${form.color === color ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white' : ''}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <select
        value={form.category}
        onChange={(e) => setForm({ ...form, category: e.target.value })}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
      >
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={form.has_action}
          onChange={(e) => setForm({ ...form, has_action: e.target.checked })}
          className="rounded border-slate-700"
        />
        Esta tag tem uma ação (instrução para a IA)
      </label>

      {form.has_action && (
        <textarea
          placeholder='Ex: "O contato já é cliente confirmado. Não pergunte se ele é cliente — vá direto identificar o que ele precisa e siga com o atendimento."'
          value={form.ai_instruction}
          onChange={(e) => setForm({ ...form, ai_instruction: e.target.value })}
          rows={3}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white resize-none"
        />
      )}

      <div className="flex gap-2">
        <Button onClick={onSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
          Salvar
        </Button>
        <Button onClick={onCancel} variant="ghost" size="sm">Cancelar</Button>
      </div>
    </div>
  );
}

export default TagsSettings;
