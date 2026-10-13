import React, { useState } from 'react';
import { Zap, Plus, Trash2, Pencil, Check, X, Copy, Loader2, Globe2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useQuickReplies, QuickReplyScope } from '@/hooks/useQuickReplies';

const VARIABLES = [
  { var: '{{nome}}', label: 'Nome do contato', example: 'João' },
  { var: '{{saudacao}}', label: 'Saudação por horário', example: 'Bom dia' },
];

const QuickRepliesSettings: React.FC = () => {
  const { replies, loading, addReply, updateReply, deleteReply } = useQuickReplies();
  const [adding, setAdding] = useState(false);
  const [newTrigger, setNewTrigger] = useState('');
  const [newText, setNewText] = useState('');
  const [newScope, setNewScope] = useState<QuickReplyScope>('global');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTrigger, setEditTrigger] = useState('');
  const [editText, setEditText] = useState('');
  const [editScope, setEditScope] = useState<QuickReplyScope>('global');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const trigger = newTrigger.trim().replace(/\s/g, '_').toLowerCase();
    const text = newText.trim();
    if (!trigger || !text) { toast.error('Preencha o atalho e o texto'); return; }
    if (replies.some(r => r.trigger === trigger)) { toast.error('Este atalho já existe'); return; }
    setSaving(true);
    try {
      await addReply(trigger, text, newScope);
      setNewTrigger('');
      setNewText('');
      setNewScope('global');
      setAdding(false);
      toast.success('Resposta rápida adicionada');
    } catch {
      toast.error('Erro ao adicionar resposta rápida');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReply(id);
      toast.success('Resposta removida');
    } catch {
      toast.error('Erro ao remover resposta');
    }
  };

  const startEdit = (id: string) => {
    const reply = replies.find(r => r.id === id);
    if (!reply) return;
    setEditingId(id);
    setEditTrigger(reply.trigger);
    setEditText(reply.text);
    setEditScope(reply.scope);
  };

  const handleSaveEdit = async () => {
    if (editingId === null) return;
    const trigger = editTrigger.trim().replace(/\s/g, '_').toLowerCase();
    const text = editText.trim();
    if (!trigger || !text) { toast.error('Preencha o atalho e o texto'); return; }
    const conflict = replies.some(r => r.trigger === trigger && r.id !== editingId);
    if (conflict) { toast.error('Este atalho já existe'); return; }
    setSaving(true);
    try {
      await updateReply(editingId, trigger, text, editScope);
      setEditingId(null);
      toast.success('Resposta atualizada');
    } catch {
      toast.error('Erro ao atualizar resposta');
    } finally {
      setSaving(false);
    }
  };

  const ScopeToggle = ({ value, onChange }: { value: QuickReplyScope; onChange: (v: QuickReplyScope) => void }) => (
    <div className="flex gap-1.5">
      <button
        type="button"
        onClick={() => onChange('global')}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
          value === 'global' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'border-slate-700 text-slate-500 hover:text-slate-300'
        }`}
        title="Visível e editável por toda a equipe"
      >
        <Globe2 className="w-3 h-3" /> Global
      </button>
      <button
        type="button"
        onClick={() => onChange('individual')}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
          value === 'individual' ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'border-slate-700 text-slate-500 hover:text-slate-300'
        }`}
        title="Visível e editável só por você"
      >
        <Lock className="w-3 h-3" /> Individual
      </button>
    </div>
  );

  const insertVar = (v: string, target: 'new' | 'edit') => {
    if (target === 'new') setNewText(prev => prev + v);
    else setEditText(prev => prev + v);
  };

  const copyVar = (v: string) => {
    navigator.clipboard.writeText(v).then(() => toast.success(`${v} copiada`));
  };

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Zap className="w-5 h-5 text-cyan-400" />
          Respostas Rápidas
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Atalhos digitados com <code className="bg-slate-800 text-cyan-400 px-1 rounded">/</code> no chat. Suportam variáveis automáticas. Compartilhadas com toda a equipe.
        </p>
      </div>

      {/* Variables reference */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Variáveis automáticas disponíveis</p>
        <div className="flex flex-wrap gap-3">
          {VARIABLES.map(v => (
            <div key={v.var} className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2">
              <span className="font-mono text-sm text-cyan-400">{v.var}</span>
              <span className="text-xs text-slate-500">{v.label}</span>
              <span className="text-xs text-slate-600">→ ex: <em className="text-slate-400">{v.example}</em></span>
              <button
                onClick={() => copyVar(v.var)}
                title="Copiar variável"
                className="text-slate-600 hover:text-cyan-400 transition-colors ml-1"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <>
            {replies.length === 0 && !adding && (
              <div className="text-center py-10 text-slate-500 text-sm">
                Nenhuma resposta rápida cadastrada ainda.
              </div>
            )}

            {replies.map((reply) => (
              <div key={reply.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                {editingId === reply.id ? (
                  <div className="space-y-3">
                    {/* Variable bar for edit */}
                    <div className="flex gap-2 flex-wrap">
                      {VARIABLES.map(v => (
                        <button
                          key={v.var}
                          onClick={() => insertVar(v.var, 'edit')}
                          className="text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-2 py-1 rounded-lg transition-colors"
                        >
                          + {v.var}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono">/</span>
                        <input
                          className="bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-3 py-2 text-sm text-slate-100 w-36 outline-none focus:border-cyan-600"
                          value={editTrigger}
                          onChange={e => setEditTrigger(e.target.value)}
                          placeholder="atalho"
                        />
                      </div>
                      <textarea
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-600 resize-none"
                        rows={2}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        placeholder="Texto da resposta com {{nome}} e {{saudacao}}"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <ScopeToggle value={editScope} onChange={setEditScope} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                        >
                          <X className="w-3 h-3" /> Cancelar
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          disabled={saving}
                          className="flex items-center gap-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" /> Salvar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 font-mono text-sm bg-slate-800 text-cyan-400 px-2 py-1 rounded-lg">
                      /{reply.trigger}
                    </span>
                    <span className="shrink-0 mt-1" title={reply.scope === 'individual' ? 'Individual' : 'Global'}>
                      {reply.scope === 'individual' ? (
                        <Lock className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <Globe2 className="w-3.5 h-3.5 text-cyan-500" />
                      )}
                    </span>
                    <p className="flex-1 text-sm text-slate-300 whitespace-pre-wrap break-words">{reply.text}</p>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(reply.id)}
                        title="Editar"
                        className="p-1.5 text-slate-500 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(reply.id)}
                        title="Remover"
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {/* Add form */}
        {adding && (
          <div className="bg-slate-900 border border-cyan-500/30 rounded-xl p-4 space-y-3">
            {/* Variable bar for new */}
            <div className="flex gap-2 flex-wrap">
              {VARIABLES.map(v => (
                <button
                  key={v.var}
                  onClick={() => insertVar(v.var, 'new')}
                  className="text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 px-2 py-1 rounded-lg transition-colors"
                >
                  + {v.var}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-mono">/</span>
                <input
                  autoFocus
                  className="bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-3 py-2 text-sm text-slate-100 w-36 outline-none focus:border-cyan-600"
                  value={newTrigger}
                  onChange={e => setNewTrigger(e.target.value)}
                  placeholder="atalho"
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <textarea
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-600 resize-none"
                rows={2}
                value={newText}
                onChange={e => setNewText(e.target.value)}
                placeholder="Texto da resposta. Use {{nome}} e {{saudacao}} para variáveis automáticas."
              />
            </div>
            <div className="flex items-center justify-between">
              <ScopeToggle value={newScope} onChange={setNewScope} />
              <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAdding(false); setNewTrigger(''); setNewText(''); setNewScope('global'); }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
              >
                <X className="w-3 h-3" /> Cancelar
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Check className="w-3 h-3" /> Adicionar
              </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add button */}
      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 px-4 py-2.5 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Resposta Rápida
        </button>
      )}
    </div>
  );
};

export default QuickRepliesSettings;
