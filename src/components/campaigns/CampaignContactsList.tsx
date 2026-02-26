import React, { useState, useEffect, useCallback } from 'react';
import { Search, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface CampaignContact {
  id: string;
  status: string;
  current_day: number;
  failed_reason: string | null;
  contact: {
    name: string | null;
    phone_number: string;
    email: string | null;
  } | null;
}

interface Props {
  campaignId: string;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  in_progress: { label: 'Em Andamento', variant: 'default' },
  success: { label: 'Sucesso', variant: 'secondary' },
  failed: { label: 'Falha', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'outline' },
  paused: { label: 'Pausado', variant: 'outline' },
};

export function CampaignContactsList({ campaignId }: Props) {
  const [contacts, setContacts] = useState<CampaignContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('campaign_contacts')
        .select('id, status, current_day, failed_reason, contacts(name, phone_number, email)')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let mapped = (data || []).map((c: any) => ({
        id: c.id,
        status: c.status,
        current_day: c.current_day,
        failed_reason: c.failed_reason,
        contact: c.contacts,
      }));

      if (search) {
        const s = search.toLowerCase();
        mapped = mapped.filter(
          (c) =>
            c.contact?.name?.toLowerCase().includes(s) ||
            c.contact?.phone_number?.includes(s) ||
            c.contact?.email?.toLowerCase().includes(s)
        );
      }

      setContacts(mapped);
    } catch (e) {
      console.error('Erro ao buscar contatos:', e);
    } finally {
      setLoading(false);
    }
  }, [campaignId, statusFilter, search]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">👥 Lista de Contatos</h2>
        <span className="text-xs text-muted-foreground">{contacts.length} contatos</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-1.5">
          {['all', 'in_progress', 'success', 'failed'].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'Todos' : STATUS_BADGE[s]?.label || s}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-secondary/20 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum contato encontrado</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {contacts.map((c) => {
            const badge = STATUS_BADGE[c.status] || { label: c.status, variant: 'outline' as const };
            return (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-lg bg-secondary/10 border border-border/30 hover:border-border/60 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground truncate">
                    {c.contact?.name || 'Sem nome'}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>📞 {c.contact?.phone_number}</span>
                    {c.contact?.email && <span>📧 {c.contact.email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={badge.variant} className="text-[10px]">
                    {badge.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Dia {c.current_day}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
