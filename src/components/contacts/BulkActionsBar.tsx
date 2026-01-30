import React from 'react';
import { X, FolderInput, Trash2, Tag as TagIcon, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ContactFolder } from './FolderManager';
import { TagDefinition } from './TagManager';

interface BulkActionsBarProps {
  selectedCount: number;
  folders: ContactFolder[];
  tags: TagDefinition[];
  onClearSelection: () => void;
  onMoveToFolder: (folderId: string | null) => void;
  onAddTag: (tagKey: string) => void;
  onDelete: () => void;
  loading: boolean;
}

const BulkActionsBar: React.FC<BulkActionsBarProps> = ({
  selectedCount,
  folders,
  tags,
  onClearSelection,
  onMoveToFolder,
  onAddTag,
  onDelete,
  loading
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-6 py-3 bg-slate-800 border border-slate-700 rounded-full shadow-2xl">
      <span className="text-sm font-medium text-white">
        {selectedCount} selecionado{selectedCount > 1 ? 's' : ''}
      </span>
      
      <div className="w-px h-6 bg-slate-600" />

      <Select onValueChange={(v) => onMoveToFolder(v === 'none' ? null : v)}>
        <SelectTrigger className="w-40 h-8 bg-slate-700 border-slate-600 text-sm">
          <FolderInput className="w-4 h-4 mr-2" />
          <span>Mover para...</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem pasta</SelectItem>
          {folders.map(folder => (
            <SelectItem key={folder.id} value={folder.id}>
              {folder.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select onValueChange={onAddTag}>
        <SelectTrigger className="w-40 h-8 bg-slate-700 border-slate-600 text-sm">
          <TagIcon className="w-4 h-4 mr-2" />
          <span>Adicionar tag...</span>
        </SelectTrigger>
        <SelectContent>
          {tags.filter(t => t.is_active).length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Nenhuma tag disponível
            </div>
          ) : (
            tags.filter(t => t.is_active).map(tag => (
              <SelectItem key={tag.id} value={tag.key}>
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.label}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      <div className="w-px h-6 bg-slate-600" />

      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        disabled={loading}
        className="h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </Button>

      <Button
        size="sm"
        variant="ghost"
        onClick={onClearSelection}
        className="h-8 text-slate-400"
      >
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default BulkActionsBar;
