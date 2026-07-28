import React, { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Star, Loader2, Cpu, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../Button';

interface AIProvider {
  id: string;
  name: string;
  kind: 'openai_compatible' | 'anthropic';
  base_url: string;
  api_key_secret_name: string;
  fast_model: string;
  smart_model: string;
  premium_model: string | null;
  is_active: boolean;
  is_default: boolean;
}

const emptyForm = {
  name: '',
  kind: 'openai_compatible' as 'openai_compatible' | 'anthropic',
  base_url: '',
  api_key_secret_name: '',
  fast_model: '',
  smart_model: '',
  premium_model: '',
};

const AIProvidersSettings: React.FC = () => {
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('ai_providers').select('*').order('name');
    if (error) {
      console.error('Erro ao carregar provedores de IA:', error);
    } else {
      setProviders((data || []) as AIProvider[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (p: AIProvider) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      kind: p.kind,
      base_url: p.base_url,
      api_key_secret_name: p.api_key_secret_name,
      fast_model: p.fast_model,
      smart_model: p.smart_model,
      premium_model: p.premium_model || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.base_url.trim() || !form.api_key_secret_name.trim() || !form.fast_model.trim() || !form.smart_model.trim()) {
      toast.error('Preencha nome, URL, nome do secret e os modelos fast/smart');
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      kind: form.kind,
      base_url: form.base_url.trim(),
      api_key_secret_name: form.api_key_secret_name.trim(),
      fast_model: form.fast_model.trim(),
      smart_model: form.smart_model.trim(),
      premium_model: form.premium_model.trim() || null,
    };

    const { error } = editingId
      ? await supabase.from('ai_providers').update(payload).eq('id', editingId)
      : await supabase.from('ai_providers').insert(payload);

    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar provedor: ' + error.message);
      return;
    }
    toast.success(editingId ? 'Provedor atualizado!' : 'Provedor criado!');
    setModalOpen(false);
    await load();
  };

  const handleDelete = async (p: AIProvider) => {
    if (p.is_default) {
      toast.error('Não é possível excluir o provedor padrão — defina outro como padrão primeiro');
      return;
    }
    if (!confirm(`Excluir o provedor "${p.name}"? Agentes que o usam voltam ao provedor padrão.`)) return;
    const { error } = await supabase.from('ai_providers').delete().eq('id', p.id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
      return;
    }
    toast.success('Provedor removido');
    await load();
  };

  const handleSetDefault = async (p: AIProvider) => {
    await supabase.from('ai_providers').update({ is_default: false }).eq('is_default', true);
    const { error } = await supabase.from('ai_providers').update({ is_default: true }).eq('id', p.id);
    if (error) {
      toast.error('Erro ao definir padrão: ' + error.message);
      return;
    }
    toast.success(`${p.name} definido como provedor padrão`);
    await load();
  };

  const toggleActive = async (p: AIProvider) => {
    const { error } = await supabase.from('ai_providers').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
      return;
    }
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400" />
            Provedores de IA
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md">
            Qualquer provedor compatível com a API da OpenAI (Gemini, OpenAI, Groq, o próprio gateway atual) ou Anthropic. Cada agente escolhe o provedor em suas configurações.
          </p>
        </div>
        <Button variant="primary" className="gap-2" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Novo Provedor
        </Button>
      </div>

      <div className="space-y-2">
        {providers.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-4 bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-slate-200">{p.name}</span>
                {p.is_default && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">padrão</span>
                )}
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  {p.kind === 'anthropic' ? 'Anthropic' : 'OpenAI-compatible'}
                </span>
                {!p.is_active && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-400 border border-red-500/25">inativo</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                fast: <span className="font-mono">{p.fast_model}</span> · smart: <span className="font-mono">{p.smart_model}</span>
                {p.premium_model && <> · premium: <span className="font-mono">{p.premium_model}</span></>}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {!p.is_default && (
                <button onClick={() => handleSetDefault(p)} title="Definir como padrão" className="p-1.5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-slate-800 transition-colors">
                  <Star className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => toggleActive(p)}
                title={p.is_active ? 'Desativar' : 'Ativar'}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${p.is_active ? 'bg-cyan-500' : 'bg-slate-700'}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${p.is_active ? 'translate-x-4.5' : 'translate-x-1'}`} />
              </button>
              <button onClick={() => openEdit(p)} title="Editar" className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => handleDelete(p)} title="Excluir" className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">{editingId ? 'Editar Provedor' : 'Novo Provedor'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Nome *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: OpenAI, Anthropic Claude, Gemini direto"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Formato de API *</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['openai_compatible', 'anthropic'] as const).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setForm({ ...form, kind })}
                      className={`p-2 rounded-lg border text-xs font-medium ${form.kind === kind ? 'bg-slate-800 border-cyan-500/50 text-white' : 'bg-slate-950 border-slate-800 text-slate-500'}`}
                    >
                      {kind === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI-compatible'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">OpenAI-compatible cobre OpenAI, Gemini, Groq e o gateway atual (Lovable AI).</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">URL base *</label>
                <input
                  value={form.base_url}
                  onChange={(e) => setForm({ ...form, base_url: e.target.value })}
                  placeholder={form.kind === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com/v1/chat/completions'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Nome do secret da API key *</label>
                <input
                  value={form.api_key_secret_name}
                  onChange={(e) => setForm({ ...form, api_key_secret_name: e.target.value })}
                  placeholder="Ex: OPENAI_API_KEY"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono"
                />
                <p className="text-xs text-slate-500">A chave em si fica nas Secrets das Edge Functions do Supabase — aqui só o nome da variável.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Modelo rápido *</label>
                  <input
                    value={form.fast_model}
                    onChange={(e) => setForm({ ...form, fast_model: e.target.value })}
                    placeholder="gpt-4o-mini"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Modelo avançado *</label>
                  <input
                    value={form.smart_model}
                    onChange={(e) => setForm({ ...form, smart_model: e.target.value })}
                    placeholder="gpt-4o"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Modelo premium (opcional)</label>
                <input
                  value={form.premium_model}
                  onChange={(e) => setForm({ ...form, premium_model: e.target.value })}
                  placeholder="Deixe em branco para usar o modelo avançado"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-white font-mono"
                />
              </div>
              <div className="pt-2 flex gap-3">
                <Button variant="ghost" onClick={() => setModalOpen(false)} className="flex-1 border border-slate-700">Cancelar</Button>
                <Button onClick={handleSave} disabled={saving} className="flex-1">
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {editingId ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProvidersSettings;
