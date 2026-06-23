import React, { useState, useEffect } from 'react';
import { FolderPlus, Folder, Trash2, Edit2, Check, X, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContactFolder {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  is_active: boolean | null;
  created_at: string;
  contact_count?: number;
}

interface FolderManagerProps {
  folders: ContactFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onFoldersChange: () => void;
}

const FOLDER_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
  '#ec4899', '#06b6d4', '#84cc16'
];

const FolderManager: React.FC<FolderManagerProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onFoldersChange
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(FOLDER_COLORS[0]);
  const [editName, setEditName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Usuário não autenticado');

const { error } = await supabase
  .from('contact_folders')
  .insert({
    name: newFolderName.trim(),
    color: newFolderColor,
    user_id: user.id
  });

      if (error) throw error;
      
      toast.success('Pasta criada com sucesso!');
      setNewFolderName('');
      setIsCreating(false);
      onFoldersChange();
    } catch (error) {
      console.error('Erro ao criar pasta:', error);
      toast.error('Erro ao criar pasta');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateFolder = async (id: string) => {
    if (!editName.trim()) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('contact_folders')
        .update({ name: editName.trim() })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Pasta atualizada!');
      setEditingId(null);
      onFoldersChange();
    } catch (error) {
      console.error('Erro ao atualizar pasta:', error);
      toast.error('Erro ao atualizar pasta');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pasta? Os contatos não serão excluídos.')) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('contact_folders')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      if (selectedFolderId === id) {
        onSelectFolder(null);
      }
      
      toast.success('Pasta excluída!');
      onFoldersChange();
    } catch (error) {
      console.error('Erro ao excluir pasta:', error);
      toast.error('Erro ao excluir pasta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Pastas</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsCreating(true)}
          className="h-7 px-2 text-cyan-400 hover:text-cyan-300"
        >
          <FolderPlus className="w-4 h-4" />
        </Button>
      </div>

      {/* Create new folder */}
      {isCreating && (
        <div className="mb-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Nome da pasta"
            className="mb-2 h-8 bg-slate-900 border-slate-700"
            autoFocus
          />
          <div className="flex gap-1 mb-2">
            {FOLDER_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setNewFolderColor(color)}
                className={`w-5 h-5 rounded-full transition-all ${
                  newFolderColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleCreateFolder}
              disabled={loading || !newFolderName.trim()}
              className="h-7 flex-1"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setIsCreating(false); setNewFolderName(''); }}
              className="h-7"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Folder list */}
      <div className="space-y-1">
        {/* All contacts */}
        <button
          onClick={() => onSelectFolder(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
            selectedFolderId === null
              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Folder className="w-4 h-4" />
          <span className="flex-1 text-left">Todos os Contatos</span>
        </button>

        {folders.map(folder => (
          <div
            key={folder.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
              selectedFolderId === folder.id
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {editingId === folder.id ? (
              <div className="flex-1 flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-6 text-xs bg-slate-900 border-slate-700"
                  autoFocus
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleUpdateFolder(folder.id)}
                  className="h-6 w-6 p-0"
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setEditingId(null)}
                  className="h-6 w-6 p-0"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onSelectFolder(folder.id)}
                  className="flex-1 flex items-center gap-2"
                >
                  <Folder className="w-4 h-4" style={{ color: folder.color || '#3b82f6' }} />
                  <span className="flex-1 text-left truncate">{folder.name}</span>
                  {folder.contact_count !== undefined && (
                    <span className="text-xs text-slate-500">{folder.contact_count}</span>
                  )}
                </button>
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                  <button
                    onClick={() => { setEditingId(folder.id); setEditName(folder.name); }}
                    className="p-1 hover:text-cyan-400"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(folder.id)}
                    className="p-1 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FolderManager;
