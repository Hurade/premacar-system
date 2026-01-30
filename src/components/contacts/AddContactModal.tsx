import React, { useState } from 'react';
import { X, Loader2, UserPlus, Tag as TagIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContactFolder } from './FolderManager';
import { TagDefinition } from './TagManager';

interface AddContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: ContactFolder[];
  tags: TagDefinition[];
  onContactAdded: () => void;
}

const AddContactModal: React.FC<AddContactModalProps> = ({
  isOpen,
  onClose,
  folders,
  tags,
  onContactAdded
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [oficina, setOficina] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string>('none');
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setPhone('');
    setOficina('');
    setSelectedTags([]);
    setFolderId('none');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const formatPhone = (value: string) => {
    return value.replace(/\D/g, '');
  };

  const toggleTag = (tagKey: string) => {
    setSelectedTags(prev => 
      prev.includes(tagKey) 
        ? prev.filter(t => t !== tagKey)
        : [...prev, tagKey]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanPhone = formatPhone(phone);
    
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error('Telefone inválido. Digite pelo menos 10 dígitos.');
      return;
    }

    setLoading(true);
    try {
      // Verificar se já existe contato com esse telefone
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_number', cleanPhone)
        .single();

      if (existing) {
        toast.error('Já existe um contato com esse telefone.');
        return;
      }

      const { error } = await supabase
        .from('contacts')
        .insert({
          name: name.trim() || null,
          phone_number: cleanPhone,
          oficina: oficina.trim() || null,
          tags: selectedTags.length > 0 ? selectedTags : null,
          folder_id: folderId === 'none' ? null : folderId
        });

      if (error) throw error;

      toast.success('Contato adicionado com sucesso!');
      onContactAdded();
      handleClose();
    } catch (error) {
      console.error('Erro ao adicionar contato:', error);
      toast.error('Erro ao adicionar contato');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const activeTags = tags.filter(t => t.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <UserPlus className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Adicionar Contato</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Nome */}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
              className="bg-slate-950 border-slate-800"
            />
          </div>

          {/* Telefone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone *</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 5511999999999"
              className="bg-slate-950 border-slate-800"
              required
            />
            <p className="text-xs text-slate-500">Formato: código do país + DDD + número</p>
          </div>

          {/* Oficina */}
          <div className="space-y-2">
            <Label htmlFor="oficina">Oficina</Label>
            <Input
              id="oficina"
              value={oficina}
              onChange={(e) => setOficina(e.target.value)}
              placeholder="Nome da oficina (opcional)"
              className="bg-slate-950 border-slate-800"
            />
          </div>

          {/* Pasta */}
          <div className="space-y-2">
            <Label>Pasta</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger className="bg-slate-950 border-slate-800">
                <SelectValue placeholder="Selecione uma pasta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma pasta</SelectItem>
                {folders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <span className="flex items-center gap-2">
                      <span 
                        className="w-2.5 h-2.5 rounded-full" 
                        style={{ backgroundColor: folder.color }}
                      />
                      {folder.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <TagIcon className="w-4 h-4" />
              Tags
            </Label>
            {activeTags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                {activeTags.map(tag => (
                  <Badge
                    key={tag.id}
                    className="px-2 py-0.5 text-xs font-medium cursor-pointer transition-all"
                    style={{ 
                      backgroundColor: selectedTags.includes(tag.key) ? `${tag.color}30` : `${tag.color}10`,
                      borderColor: selectedTags.includes(tag.key) ? tag.color : `${tag.color}30`,
                      color: tag.color,
                      borderWidth: selectedTags.includes(tag.key) ? '2px' : '1px'
                    }}
                    onClick={() => toggleTag(tag.key)}
                  >
                    {tag.label}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Nenhuma tag disponível. Crie tags na barra lateral.
              </p>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 shadow-lg shadow-cyan-500/20"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Adicionar
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddContactModal;
