import React, { useState, useEffect, useMemo } from 'react';
import { Search, Upload, Users, Filter, CheckSquare, Square } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import type { CampaignFormData } from '@/pages/CreateCampaign';

interface Step3Props {
  data: CampaignFormData;
  onChange: (data: CampaignFormData) => void;
}

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  tags: string[] | null;
}

export function Step3AddContacts({ data, onChange }: Step3Props) {
  const [method, setMethod] = useState<'manual' | 'filter'>('manual');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');

  useEffect(() => {
    async function fetchContacts() {
      setLoading(true);
      const { data: contactsData, error } = await supabase
        .from('contacts')
        .select('id, name, phone_number, email, tags')
        .order('name');
      if (!error) setContacts((contactsData as Contact[]) || []);
      setLoading(false);
    }
    fetchContacts();
  }, []);

  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      const matchesSearch =
        !search ||
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        c.phone_number.includes(search);
      const matchesTag =
        !tagFilter ||
        (c.tags || []).some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()));
      return matchesSearch && matchesTag;
    });
  }, [contacts, search, tagFilter]);

  const selectedSet = new Set(data.contacts);

  const toggleContact = (id: string) => {
    const newSet = new Set(selectedSet);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    onChange({ ...data, contacts: Array.from(newSet) });
  };

  const selectAll = () => {
    const allIds = filteredContacts.map((c) => c.id);
    onChange({ ...data, contacts: Array.from(new Set([...data.contacts, ...allIds])) });
  };

  const deselectAll = () => {
    const filteredIds = new Set(filteredContacts.map((c) => c.id));
    onChange({ ...data, contacts: data.contacts.filter((id) => !filteredIds.has(id)) });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">👥 Adicionar Contatos</h2>

      {/* Method tabs */}
      <div className="flex gap-2">
        <Button
          variant={method === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('manual')}
          className="gap-2"
        >
          <Users className="w-4 h-4" />
          Selecionar Contatos
        </Button>
        <Button
          variant={method === 'filter' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMethod('filter')}
          className="gap-2"
        >
          <Filter className="w-4 h-4" />
          Filtrar por Tag
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {method === 'filter' && (
          <Input
            placeholder="Filtrar por tag..."
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="w-48"
          />
        )}
      </div>

      {/* Bulk actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={selectAll} className="gap-1.5 text-xs">
            <CheckSquare className="w-3.5 h-3.5" />
            Selecionar Todos ({filteredContacts.length})
          </Button>
          <Button variant="ghost" size="sm" onClick={deselectAll} className="gap-1.5 text-xs">
            <Square className="w-3.5 h-3.5" />
            Desmarcar
          </Button>
        </div>
        <Badge variant="secondary">{data.contacts.length} selecionados</Badge>
      </div>

      {/* Contact list */}
      <div className="border border-border/50 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Carregando contatos...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">Nenhum contato encontrado</div>
        ) : (
          filteredContacts.map((contact) => (
            <label
              key={contact.id}
              className="flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors cursor-pointer border-b border-border/30 last:border-b-0"
            >
              <Checkbox
                checked={selectedSet.has(contact.id)}
                onCheckedChange={() => toggleContact(contact.id)}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {contact.name || 'Sem nome'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {contact.phone_number}
                  {contact.email && ` • ${contact.email}`}
                </p>
              </div>
              {contact.tags && contact.tags.length > 0 && (
                <div className="flex gap-1 shrink-0">
                  {contact.tags.slice(0, 2).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                  ))}
                  {contact.tags.length > 2 && (
                    <Badge variant="outline" className="text-[10px]">+{contact.tags.length - 2}</Badge>
                  )}
                </div>
              )}
            </label>
          ))
        )}
      </div>

      {/* Summary */}
      {data.contacts.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <h3 className="font-semibold text-foreground text-sm mb-2">📊 Resumo</h3>
          <p className="text-sm text-foreground">✅ {data.contacts.length} contatos selecionados</p>
        </div>
      )}
    </div>
  );
}
