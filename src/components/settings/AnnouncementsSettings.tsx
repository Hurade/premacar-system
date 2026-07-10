import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/Button';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface Announcement {
  id: string;
  title: string;
  body: string;
  is_active: boolean;
  created_at: string;
}

const AnnouncementsSettings: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.fetchAnnouncements();
      setAnnouncements(data as Announcement[]);
    } catch (err) {
      toast.error('Erro ao carregar anúncios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error('Preencha título e mensagem');
      return;
    }
    try {
      await api.createAnnouncement(title, body);
      setTitle('');
      setBody('');
      setIsCreating(false);
      toast.success('Anúncio publicado');
      load();
    } catch (err) {
      toast.error('Erro ao publicar anúncio');
    }
  };

  const handleToggleActive = async (announcement: Announcement) => {
    try {
      await api.updateAnnouncement(announcement.id, { is_active: !announcement.is_active });
      load();
    } catch (err) {
      toast.error('Erro ao atualizar anúncio');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este anúncio?')) return;
    try {
      await api.deleteAnnouncement(id);
      toast.success('Anúncio excluído');
      load();
    } catch (err) {
      toast.error('Erro ao excluir anúncio');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Publique avisos internos que aparecerão para toda a equipe em <span className="font-mono">/avisos</span>.
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
        </div>
      ) : (
        <div className="space-y-3">
          {isCreating ? (
            <div className="bg-card/50 border border-border rounded-lg p-4 space-y-3">
              <input
                type="text"
                placeholder="Título do anúncio"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Mensagem"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none"
              />
              <div className="flex gap-2">
                <Button onClick={handleCreate}>Publicar</Button>
                <Button onClick={() => setIsCreating(false)} variant="ghost">Cancelar</Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="w-full bg-card/30 border border-dashed border-border rounded-lg p-4 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Anúncio
            </button>
          )}

          {announcements.map((a) => (
            <div key={a.id} className="bg-card/50 border border-border rounded-lg p-4 flex items-start justify-between gap-4">
              <div>
                <div className={`text-sm font-semibold ${a.is_active ? '' : 'text-muted-foreground line-through'}`}>{a.title}</div>
                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>
                <p className="text-[10px] text-muted-foreground mt-2">
                  {new Date(a.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => handleToggleActive(a)} title={a.is_active ? 'Desativar' : 'Ativar'} className="p-2 text-muted-foreground hover:text-foreground">
                  {a.is_active ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                </button>
                <button onClick={() => handleDelete(a.id)} className="p-2 text-muted-foreground hover:text-red-400">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {announcements.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum anúncio publicado ainda.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AnnouncementsSettings;
