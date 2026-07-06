import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface SystemLog {
  id: string;
  created_at: string;
  source: string;
  level: 'info' | 'error' | 'warning';
  message: string;
  metadata: Record<string, unknown> | null;
  user_id: string | null;
}

const LEVEL_BADGE: Record<string, string> = {
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const PAGE_SIZE = 50;

export default function Logs() {
  const [source, setSource] = useState('all');
  const [level, setLevel] = useState('all');
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Debounce search input — reset page when debounced value updates
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Count query (separate, no rows fetched) ──────────────────────────────────
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['system-logs-count', source, level, searchDebounced],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('system_logs')
        .select('*', { count: 'exact', head: true });
      if (source !== 'all') query = query.eq('source', source);
      if (level !== 'all') query = query.eq('level', level);
      if (searchDebounced) query = query.ilike('message', `%${searchDebounced}%`);
      const { count, error } = await query;
      if (error) throw error;
      return count as number || 0;
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  // ── Data query (current page only) ──────────────────────────────────────────
  const { data: logs = [], isFetching, refetch } = useQuery({
    queryKey: ['system-logs', source, level, searchDebounced, page],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (source !== 'all') query = query.eq('source', source);
      if (level !== 'all') query = query.eq('level', level);
      if (searchDebounced) query = query.ilike('message', `%${searchDebounced}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SystemLog[];
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });

  return (
    <div className="h-full overflow-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Logs do Sistema</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitoramento de eventos e erros</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={source} onValueChange={(v) => { setSource(v); setPage(0); }}>
          <SelectTrigger className="w-52 bg-card border-border">
            <SelectValue placeholder="Fonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as fontes</SelectItem>
            <SelectItem value="campaign-processor">campaign-processor</SelectItem>
            <SelectItem value="whatsapp-sender">whatsapp-sender</SelectItem>
            <SelectItem value="nina-orchestrator">nina-orchestrator</SelectItem>
            <SelectItem value="make-voice-call">make-voice-call</SelectItem>
            <SelectItem value="twilio-call">twilio-call</SelectItem>
            <SelectItem value="recurring-campaign-processor">recurring-campaign-processor</SelectItem>
          </SelectContent>
        </Select>

        <Select value={level} onValueChange={(v) => { setLevel(v); setPage(0); }}>
          <SelectTrigger className="w-40 bg-card border-border">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Buscar na mensagem..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72 bg-card border-border"
        />

        <span className="self-center text-sm text-muted-foreground ml-auto">
          {totalCount} registros encontrados
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/50">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium w-36">Data/Hora</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium w-20">Nível</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium w-44">Fonte</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum log encontrado
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
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border ${LEVEL_BADGE[log.level] || 'bg-muted text-muted-foreground'}`}>
                        {log.level}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs truncate max-w-[11rem]">
                      {log.source}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {log.message}
                      {log.metadata && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {expandedId === log.id ? '▲' : '▼'}
                        </span>
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
