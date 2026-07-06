import React, { useState, useEffect } from 'react';
import { X, Loader2, Pencil, Tag as TagIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContactFolder } from './FolderManager';
import { TagDefinition } from './TagManager';
import { CustomFieldsSection } from './CustomFieldsSection';

interface EditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  folders: ContactFolder[];
  tags: TagDefinition[];
  onContactUpdated: () => void;
  contact: {
    id: string;
    name: string | null;
    phone_number: string;
    oficina: string | null;
    email: string | null;
    tags: string[] | null;
    folder_id: string | null;
  } | null;
}

const EditContactModal: React.FC<EditContactModalProps> = ({
  isOpen,
  onClose,
  folders,
  tags,
  onContactUpdated,
  contact
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [oficina, setOficina] = useState('');
  const [email, setEmail] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string>('none');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (contact) {
      setName(contact.name || '');
      setPhone(contact.phone_number || '');
      setOficina(contact.oficina || '');
      setEmail(contact.email || '');
      setSelectedTags(contact.tags || []);
      setFolderId(contact.folder_id || 'none');
    }
  }, [contact]);

  const handleClose = () => {
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
    if (!contact) return;
    
    const cleanPhone = formatPhone(phone);
    
    if (!cleanPhone || cleanPhone.length < 10) {
      toast.error('Telefone inválido. Digite pelo menos 10 dígitos.');
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Email inválido.');
      return;
    }

    setLoading(true);
    try {
      // Check if phone changed and already exists
      if (cleanPhone !== contact.phone_number) {
        const { data: existing } = await supabase
          .from('contacts')
          .select('id')
          .eq('phone_number', cleanPhone)
          .neq('id', contact.id)
          .maybeSingle();

        if (existing) {
          toast.error('Já existe outro contato com esse telefone.');
          setLoading(false);
          return;
        }
      }

      const newlyAddedTags = selectedTags.filter((t) => !(contact.tags || []).includes(t));

      const { error } = await supabase
        .from('contacts')
        .update({
          name: name.trim() || null,
          phone_number: cleanPhone,
          oficina: oficina.trim() || null,
          email: email.trim() || null,
          tags: selectedTags.length > 0 ? selectedTags : null,
          folder_id: folderId === 'none' ? null : folderId
        })
        .eq('id', contact.id);

      if (error) throw error;

      if (newlyAddedTags.length > 0) {
        supabase.functions.invoke('automation-executor', {
          body: { event_type: 'tag_applied', contact_id: contact.id, tags: newlyAddedTags },
        }).catch((err) => console.error('[EditContactModal] Error triggering automation-executor:', err));
      }

      toast.success('Contato atualizado com sucesso!');
      onContactUpdated();
      handleClose();
    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      toast.error('Erro ao atualizar contato');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !contact) return null;

  const activeTags = tags.filter(t => t.is_active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Pencil className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Editar Contato</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do contato"
              className="bg-slate-950 border-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-phone">Telefone *</Label>
            <Input
              id="edit-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: 5511999999999"
              className="bg-slate-950 border-slate-800"
              required
            />
            <p className="text-xs text-slate-500">Formato: código do país + DDD + número</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com (opcional)"
              className="bg-slate-950 border-slate-800"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-oficina">Oficina</Label>
            <Input
              id="edit-oficina"
              value={oficina}
              onChange={(e) => setOficina(e.target.value)}
              placeholder="Nome da oficina (opcional)"
              className="bg-slate-950 border-slate-800"
            />
          </div>

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
                        style={{ backgroundColor: folder.color || '#3b82f6' }}
                      />
                      {folder.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

          <CustomFieldsSection contactId={contact.id} />

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
                  <Pencil className="w-4 h-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditContactModal;
