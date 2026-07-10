import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, Save, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/Button';
import { api } from '@/services/api';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Queue {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
}

const Filas: React.FC = () => {
  const [queues, setQueues] = useState<Queue[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', color: '#652c90' });
  const [isCreating, setIsCreating] = useState(false);

  const loadQueues = async () => {
    setLoading(true);
    try {
      const data = await api.fetchQueues();
      setQueues(data as Queue[]);
    } catch (err) {
      console.error('Error loading queues:', err);
      toast.error('Erro ao carregar filas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueues();

    const channel = supabase
      .channel('queues-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, loadQueues)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleCreate = async () => {
    if (!editForm.name.trim()) return;
    try {
      await api.createQueue(editForm.name, editForm.color);
      setEditForm({ name: '', color: '#652c90' });
      setIsCreating(false);
      toast.success('Fila criada');
    } catch (err) {
      toast.error('Erro ao criar fila');
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await api.updateQueue(id, { name: editForm.name, color: editForm.color });
      setEditingId(null);
      toast.success('Fila atualizada');
    } catch (err) {
      toast.error('Erro ao atualizar fila');
    }
  };

  const handleToggleActive = async (queue: Queue) => {
    try {
      await api.updateQueue(queue.id, { is_active: !queue.is_active });
    } catch (err) {
      toast.error('Erro ao atualizar fila');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta fila? As conversas atribuídas a ela ficarão sem fila.')) return;
    try {
      await api.deleteQueue(id);
      toast.success('Fila excluída');
    } catch (err) {
      toast.error('Erro ao excluir fila');
    }
  };

  const startEdit = (queue: Queue) => {
    setEditingId(queue.id);
    setEditForm({ name: queue.name, color: queue.color });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Layers className="w-7 h-7 text-cyan-400" />
          Filas de Atendimento
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Categorize e roteie conversas por setor/departamento. Não substitui a atribuição individual (Responsável) — é um filtro adicional para equipes com vários setores.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {isCreating ? (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 space-y-3">
              <input
                type="text"
                placeholder="Nome da fila (ex: Comercial, Suporte)"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
              />
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={editForm.color}
                  onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                  className="w-12 h-8 rounded cursor-pointer"
                  aria-label="Cor da fila"
                />
                <span className="text-xs text-slate-400">Cor da fila</span>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} className="flex-1">Salvar</Button>
                <Button onClick={() => setIsCreating(false)} variant="ghost">Cancelar</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full bg-slate-800/30 border border-dashed border-slate-700 rounded-lg p-4 text-slate-400 hover:text-white hover:border-slate-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Fila
            </button>
          )}

          {queues.map((queue) => (
            <div key={queue.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              {editingId === queue.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                  />
                  <input
                    type="color"
                    value={editForm.color}
                    onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                    className="w-12 h-8 rounded cursor-pointer"
                    aria-label="Cor da fila"
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => handleUpdate(queue.id)} size="sm">
                      <Save className="w-3 h-3 mr-1" />
                      Salvar
                    </Button>
                    <Button onClick={() => setEditingId(null)} variant="ghost" size="sm">Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: queue.color }}></div>
                    <div className={`text-sm font-medium ${queue.is_active ? 'text-white' : 'text-slate-500 line-through'}`}>
                      {queue.name}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggleActive(queue)}
                      className="p-2 text-slate-400 hover:text-white transition-colors"
                      title={queue.is_active ? 'Desativar fila' : 'Ativar fila'}
                    >
                      {queue.is_active ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => startEdit(queue)}
                      className="p-2 text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(queue.id)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {queues.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-8">Nenhuma fila criada ainda.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default Filas;
