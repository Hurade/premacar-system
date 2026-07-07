import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Save, Loader2, ListPlus } from 'lucide-react';
import { Button } from '../Button';
import {
  useCustomFieldDefinitions,
  useCreateCustomFieldDefinition,
  useUpdateCustomFieldDefinition,
  useDeleteCustomFieldDefinition,
  type CustomFieldType,
} from '@/hooks/useCustomFieldDefinitions';

const TYPE_LABELS: Record<CustomFieldType, string> = {
  texto: 'Texto',
  numero: 'Número',
  data: 'Data',
  select: 'Seleção',
};

const emptyForm = { nome: '', tipo: 'texto' as CustomFieldType, opcoesText: '', obrigatorio: false };

const CustomFieldsSettings: React.FC = () => {
  const { data: fields, isLoading } = useCustomFieldDefinitions();
  const createMutation = useCreateCustomFieldDefinition();
  const updateMutation = useUpdateCustomFieldDefinition();
  const deleteMutation = useDeleteCustomFieldDefinition();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const resetForm = () => {
    setForm(emptyForm);
    setIsCreating(false);
    setEditingId(null);
  };

  const parseOpcoes = (text: string) => text.split(',').map((o) => o.trim()).filter(Boolean);

  const handleCreate = () => {
    if (!form.nome.trim()) return;
    createMutation.mutate(
      { nome: form.nome, tipo: form.tipo, opcoes: form.tipo === 'select' ? parseOpcoes(form.opcoesText) : [], obrigatorio: form.obrigatorio },
      { onSuccess: resetForm }
    );
  };

  const startEdit = (field: NonNullable<typeof fields>[number]) => {
    setEditingId(field.id);
    setForm({ nome: field.nome, tipo: field.tipo, opcoesText: field.opcoes.join(', '), obrigatorio: field.obrigatorio });
  };

  const handleUpdate = (id: string) => {
    updateMutation.mutate(
      {
        id,
        nome: form.nome,
        tipo: form.tipo,
        opcoes: form.tipo === 'select' ? parseOpcoes(form.opcoesText) : [],
        obrigatorio: form.obrigatorio,
      },
      { onSuccess: resetForm }
    );
  };

  const handleToggleAtivo = (id: string, ativo: boolean) => {
    updateMutation.mutate({ id, ativo: !ativo });
  };

  const handleDelete = (id: string, nome: string) => {
    if (!confirm(`Excluir o campo "${nome}"? Isso apaga os valores já preenchidos em todos os contatos.`)) return;
    deleteMutation.mutate(id);
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-200">Campos Personalizados de Contato</h3>
        <p className="text-xs text-slate-500 mt-1">
          Defina campos extras exibidos na ficha de cada contato (ex: segmento, ERP usado, valor do ticket médio).
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {isCreating ? (
            <FieldForm form={form} setForm={setForm} onSave={handleCreate} onCancel={resetForm} saving={createMutation.isPending} />
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full bg-slate-800/30 border border-dashed border-slate-700 rounded-lg p-4 text-slate-400 hover:text-white hover:border-slate-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Campo
            </button>
          )}

          {(fields || []).map((field) =>
            editingId === field.id ? (
              <FieldForm
                key={field.id}
                form={form}
                setForm={setForm}
                onSave={() => handleUpdate(field.id)}
                onCancel={resetForm}
                saving={updateMutation.isPending}
              />
            ) : (
              <div key={field.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ListPlus className="w-4 h-4 text-slate-500" />
                  <div>
                    <div className="text-sm font-medium text-white flex items-center gap-2">
                      {field.nome}
                      {!field.ativo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">Inativo</span>}
                      {field.obrigatorio && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">Obrigatório</span>}
                    </div>
                    <div className="text-xs text-slate-400">
                      {TYPE_LABELS[field.tipo]}
                      {field.tipo === 'select' && field.opcoes.length > 0 ? ` — ${field.opcoes.join(', ')}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleAtivo(field.id, field.ativo)}
                    className="text-xs text-slate-400 hover:text-white transition-colors px-2"
                    title={field.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {field.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => startEdit(field)} className="p-2 text-slate-400 hover:text-white transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(field.id, field.nome)} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          )}

          {!isLoading && (fields?.length ?? 0) === 0 && !isCreating && (
            <p className="text-xs text-slate-500 text-center py-4">Nenhum campo personalizado criado ainda.</p>
          )}
        </div>
      )}
    </div>
  );
};

function FieldForm({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
}: {
  form: typeof emptyForm;
  setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
      <input
        type="text"
        placeholder="Nome do campo (ex: Segmento)"
        value={form.nome}
        onChange={(e) => setForm({ ...form, nome: e.target.value })}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
      />
      <select
        value={form.tipo}
        onChange={(e) => setForm({ ...form, tipo: e.target.value as CustomFieldType })}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
      >
        {Object.entries(TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      {form.tipo === 'select' && (
        <input
          type="text"
          placeholder="Opções separadas por vírgula (ex: Oficina, Auto Center, Rede)"
          value={form.opcoesText}
          onChange={(e) => setForm({ ...form, opcoesText: e.target.value })}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        />
      )}
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input
          type="checkbox"
          checked={form.obrigatorio}
          onChange={(e) => setForm({ ...form, obrigatorio: e.target.checked })}
          className="rounded border-slate-700"
        />
        Campo obrigatório
      </label>
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

export default CustomFieldsSettings;
