import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RefreshCw, ScrollText } from 'lucide-react';
import { api } from '@/services/api';

interface UserActionLog {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
}

interface ActorOption {
  id: string;
  name: string;
  user_id: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  assign_conversation: 'Atribuir conversa',
  assign_queue: 'Atribuir fila',
  finalize_conversation: 'Finalizar atendimento',
  delete_conversation: 'Excluir conversa',
  espiar_conversa: 'Espiar conversa',
  export_messages: 'Exportar mensagens',
  deal_won: 'Negócio ganho',
  deal_lost: 'Negócio perdido',
  merge_contacts: 'Mesclar contatos',
  invite_team_member: 'Convidar membro',
  update_team_member: 'Atualizar membro',
  create_announcement: 'Criar anúncio',
  create_automation_rule: 'Criar automação',
  update_automation_rule: 'Editar automação',
  delete_automation_rule: 'Excluir automação',
  toggle_automation_rule: 'Ativar/desativar automação',
};

const PAGE_SIZE = 50;

export default function AuditLog() {
  const [action, setAction] = useState('all');
  const [actorId, setActorId] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [actors, setActors] = useState<ActorOption[]>([]);

  useEffect(() => {
    api.fetchTeam().then((members: any[]) => {
      setActors(members.map(m => ({ id: m.id, name: m.name, user_id: m.user_id })));
    }).catch(err => console.error('Error loading team members:', err));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const actorUserId = actorId !== 'all' ? actors.find(a => a.id === actorId)?.user_id : undefined;

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['user-action-logs-count', action, actorUserId, searchDebounced],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('user_action_logs')
        .select('*', { count: 'exact', head: true });
      if (action !== 'all') query = query.eq('action', action);
      if (actorUserId) query = query.eq('actor_id', actorUserId);
      if (searchDebounced) query = query.ilike('entity_type', `%${searchDebounced}%`);
      const { count, error } = await query;
      if (error) throw error;
      return count as number || 0;
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const { data: logs = [], isFetching, refetch } = useQuery({
    queryKey: ['user-action-logs', action, actorUserId, searchDebounced, page],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('user_action_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (action !== 'all') query = query.eq('action', action);
      if (actorUserId) query = query.eq('actor_id', actorUserId);
      if (searchDebounced) query = query.ilike('entity_type', `%${searchDebounced}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as UserActionLog[];
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

  const actorName = (log: UserActionLog) => {
    if (!log.actor_id) return 'Sistema';
    return actors.find(a => a.user_id === log.actor_id)?.name || log.actor_id.slice(0, 8);
  };

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <ScrollText className="w-6 h-6" />
            Registro de Atividades
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ações realizadas pela equipe no sistema</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(0); }}>
          <SelectTrigger className="w-56 bg-card border-border">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actorId} onValueChange={(v) => { setActorId(v); setPage(0); }}>
          <SelectTrigger className="w-52 bg-card border-border">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os membros</SelectItem>
            {actors.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Buscar por tipo de entidade..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 bg-card border-border"
        />

        <span className="self-center text-sm text-muted-foreground ml-auto">
          {totalCount} registros encontrados
        </span>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/50">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium w-36">Data/Hora</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium w-40">Responsável</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium w-48">Ação</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Entidade</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    className="border-b border-border/50 hover:bg-card/60 cursor-pointer transition-colors"
                    onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-xs">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-3 text-foreground">{actorName(log)}</td>
                    <td className="px-4 py-3">
                      <Badge className="text-xs border bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
                        {ACTION_LABELS[log.action] || log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                      {log.entity_type}{log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ''}
                      {log.metadata && (
                        <span className="ml-2 text-xs">{expandedId === log.id ? '▲' : '▼'}</span>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && log.metadata && (
                    <tr key={`${log.id}-meta`} className="border-b border-border/50 bg-muted/20">
                      <td colSpan={4} className="px-4 py-3">
                        <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono overflow-auto max-h-48 bg-slate-900/60 rounded-lg p-3">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
