import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

interface CsatSurvey {
  id: string;
  rating: number | null;
  comment: string | null;
  sent_at: string;
  responded_at: string | null;
  contact: { name: string | null; call_name: string | null; phone_number: string } | null;
}

const PAGE_SIZE = 30;

export default function Ratings() {
  const [page, setPage] = useState(0);

  const { data: stats } = useQuery({
    queryKey: ['csat-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('csat_surveys')
        .select('rating')
        .not('responded_at', 'is', null);
      if (error) throw error;
      const ratings = (data || []).map(r => r.rating).filter((r): r is number => r !== null);
      const distribution = [1, 2, 3, 4, 5].map(star => ratings.filter(r => r === star).length);
      const average = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
      return { average, total: ratings.length, distribution };
    },
    staleTime: 30_000,
  });

  const { data: totalCount = 0 } = useQuery({
    queryKey: ['csat-responses-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('csat_surveys')
        .select('*', { count: 'exact', head: true })
        .not('responded_at', 'is', null);
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: responses = [], isFetching, refetch } = useQuery({
    queryKey: ['csat-responses', page],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('csat_surveys')
        .select('id, rating, comment, sent_at, responded_at, contact:contacts(name, call_name, phone_number)')
        .not('responded_at', 'is', null)
        .order('responded_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      return (data || []) as unknown as CsatSurvey[];
    },
  });

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const maxCount = Math.max(1, ...(stats?.distribution || [1]));

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
            Avaliações de Atendimento
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Pesquisas de satisfação (CSAT) enviadas ao finalizar atendimentos</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card/50 p-6 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-foreground">{(stats?.average || 0).toFixed(1)}</span>
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3, 4, 5].map(star => (
              <Star
                key={star}
                className={`w-5 h-5 ${(stats?.average || 0) >= star ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`}
              />
            ))}
          </div>
          <span className="text-sm text-muted-foreground mt-1">{stats?.total || 0} avaliações respondidas</span>
        </div>

        <div className="rounded-xl border border-border bg-card/50 p-6 space-y-2">
          {[5, 4, 3, 2, 1].map(star => {
            const count = stats?.distribution[star - 1] || 0;
            return (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-3 text-muted-foreground">{star}</span>
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-card/50">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium w-36">Data</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium w-48">Contato</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium w-24">Nota</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Comentário</th>
            </tr>
          </thead>
          <tbody>
            {responses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhuma avaliação respondida ainda
                </td>
              </tr>
            ) : (
              responses.map((r) => (
                <tr key={r.id} className="border-b border-border/50">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap font-mono text-xs">
                    {r.responded_at ? new Date(r.responded_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {r.contact?.name || r.contact?.call_name || r.contact?.phone_number || 'Contato removido'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star key={star} className={`w-3.5 h-3.5 ${(r.rating || 0) >= star ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.comment || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Página {page + 1} de {totalPages}</span>
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
