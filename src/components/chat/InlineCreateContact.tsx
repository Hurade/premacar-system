import React, { useState, useEffect } from 'react';
import { Loader2, UserPlus, Tag as TagIcon } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface TagDef {
  id: string;
  key: string;
  label: string;
  color: string;
  is_active: boolean;
}

interface FolderDef {
  id: string;
  name: string;
  color: string | null;
}

interface InlineCreateContactProps {
  onContactCreated: (contactId: string, name: string | null, phoneNumber: string) => void;
  onCancel: () => void;
}

const InlineCreateContact: React.FC<InlineCreateContactProps> = ({ onContactCreated, onCancel }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [oficina, setOficina] = useState('');
  const [email, setEmail] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [folderId, setFolderId] = useState<string>('none');
  const [loading, setLoading] = useState(false);

  const [tags, setTags] = useState<TagDef[]>([]);
  const [folders, setFolders] = useState<FolderDef[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const [tagsRes, foldersRes] = await Promise.all([
        supabase.from('tag_definitions').select('id, key, label, color, is_active').eq('is_active', true),
        supabase.from('contact_folders').select('id, name, color').eq('is_active', true),
      ]);
      if (tagsRes.data) setTags(tagsRes.data);
      if (foldersRes.data) setFolders(foldersRes.data);
    };
    loadData();
  }, []);

  const toggleTag = (tagKey: string) => {
    setSelectedTags(prev =>
      prev.includes(tagKey) ? prev.filter(t => t !== tagKey) : [...prev, tagKey]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');

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
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_number', cleanPhone)
        .maybeSingle();

      if (existing) {
        toast.error('Já existe um contato com esse telefone. Selecione-o na lista.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          name: name.trim() || null,
          phone_number: cleanPhone,
          oficina: oficina.trim() || null,
          email: email.trim() || null,
          tags: selectedTags.length > 0 ? selectedTags : null,
          folder_id: folderId === 'none' ? null : folderId,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Contato criado!');
      onContactCreated(data.id, name.trim() || null, cleanPhone);
    } catch (error) {
      console.error('Erro ao criar contato:', error);
      toast.error('Erro ao criar contato');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="ic-phone" className="text-slate-300">Telefone *</Label>
        <Input
          id="ic-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Ex: 5511999999999"
          className="bg-slate-800 border-slate-700 text-slate-200"
          required
        />
        <p className="text-[11px] text-slate-500">Código do país + DDD + número</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ic-name" className="text-slate-300">Nome</Label>
        <Input
          id="ic-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do contato"
          className="bg-slate-800 border-slate-700 text-slate-200"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ic-oficina" className="text-slate-300">Oficina</Label>
        <Input
          id="ic-oficina"
          value={oficina}
          onChange={(e) => setOficina(e.target.value)}
          placeholder="Nome da oficina (opcional)"
          className="bg-slate-800 border-slate-700 text-slate-200"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ic-email" className="text-slate-300">Email</Label>
        <Input
          id="ic-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@exemplo.com (opcional)"
          className="bg-slate-800 border-slate-700 text-slate-200"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-slate-300">Pasta</Label>
        <Select value={folderId} onValueChange={setFolderId}>
          <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
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

      {tags.length > 0 && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2 text-slate-300">
            <TagIcon className="w-4 h-4" />
            Tags
          </Label>
          <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-800/50 rounded-lg border border-slate-700">
            {tags.map(tag => (
              <Badge
                key={tag.id}
                className="px-2 py-0.5 text-xs font-medium cursor-pointer transition-all"
                style={{
                  backgroundColor: selectedTags.includes(tag.key) ? `${tag.color}30` : `${tag.color}10`,
                  borderColor: selectedTags.includes(tag.key) ? tag.color : `${tag.color}30`,
                  color: tag.color,
                  borderWidth: selectedTags.includes(tag.key) ? '2px' : '1px',
                }}
                onClick={() => toggleTag(tag.key)}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={loading}>
          Voltar
        </Button>
        <Button type="submit" className="flex-1 gap-2" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Criando...
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" />
              Criar e Iniciar Conversa
            </>
          )}
        </Button>
      </div>
    </form>
  );
};

export default InlineCreateContact;
