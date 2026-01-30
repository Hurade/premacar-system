import React, { useState } from 'react';
import { Plus, X, Tag as TagIcon, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TagDefinition {
  id: string;
  key: string;
  label: string;
  color: string;
  category: string;
  is_active: boolean;
}

interface TagManagerProps {
  tags: TagDefinition[];
  onTagsChange: () => void;
}

const TAG_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

const TagManager: React.FC<TagManagerProps> = ({ tags, onTagsChange }) => {
  const [newTagLabel, setNewTagLabel] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleCreateTag = async () => {
    if (!newTagLabel.trim()) {
      toast.error('Digite o nome da tag');
      return;
    }

    // Gerar key a partir do label
    const key = newTagLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    // Verificar se já existe
    if (tags.some(t => t.key === key)) {
      toast.error('Já existe uma tag com esse nome');
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from('tag_definitions')
        .insert({
          key,
          label: newTagLabel.trim(),
          color: selectedColor,
          category: 'custom',
          is_active: true
        });

      if (error) throw error;

      toast.success('Tag criada com sucesso!');
      setNewTagLabel('');
      setShowForm(false);
      onTagsChange();
    } catch (error) {
      console.error('Erro ao criar tag:', error);
      toast.error('Erro ao criar tag');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta tag?')) return;

    try {
      const { error } = await supabase
        .from('tag_definitions')
        .update({ is_active: false })
        .eq('id', tagId);

      if (error) throw error;

      toast.success('Tag removida!');
      onTagsChange();
    } catch (error) {
      console.error('Erro ao remover tag:', error);
      toast.error('Erro ao remover tag');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TagIcon className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-medium text-slate-300">Tags</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowForm(!showForm)}
          className="h-7 px-2 text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Nova
        </Button>
      </div>

      {showForm && (
        <div className="p-3 bg-slate-800/50 rounded-lg space-y-3">
          <Input
            value={newTagLabel}
            onChange={(e) => setNewTagLabel(e.target.value)}
            placeholder="Nome da tag"
            className="h-8 text-sm bg-slate-900 border-slate-700"
          />
          <div className="flex items-center gap-1.5">
            {TAG_COLORS.map(color => (
              <button
                key={color}
                onClick={() => setSelectedColor(color)}
                className={`w-5 h-5 rounded-full transition-all ${
                  selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-slate-800 ring-white' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
              className="flex-1 h-7 text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleCreateTag}
              disabled={creating}
              className="flex-1 h-7 text-xs"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Criar'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tags.filter(t => t.is_active).map(tag => (
          <Badge
            key={tag.id}
            className="pl-2 pr-1 py-0.5 text-xs font-medium cursor-default group"
            style={{ 
              backgroundColor: `${tag.color}20`,
              borderColor: `${tag.color}40`,
              color: tag.color 
            }}
          >
            {tag.label}
            <button
              onClick={() => handleDeleteTag(tag.id)}
              className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
        {tags.filter(t => t.is_active).length === 0 && (
          <span className="text-xs text-slate-500">Nenhuma tag criada</span>
        )}
      </div>
    </div>
  );
};

export default TagManager;
