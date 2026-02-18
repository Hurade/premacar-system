import React, { useState } from 'react';
import { useDispatchConversations, DispatchFilters, DateFilterType, StatusFilter } from '@/hooks/useDispatchConversations';
import { MessageSquare, Check, CheckCheck, Loader2, Clock, Filter, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_FILTERS: DispatchFilters = {
  dateFilter: '7days',
  statusFilter: 'all',
};

export const DispatchConversations: React.FC = () => {
  const [filters, setFilters] = useState<DispatchFilters>(DEFAULT_FILTERS);
  const { data: conversations, isLoading } = useDispatchConversations(filters);

  const updateFilter = <K extends keyof DispatchFilters>(key: K, value: DispatchFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const dateFilterOptions: { value: DateFilterType; label: string }[] = [
    { value: '7days', label: 'Últimos 7 dias' },
    { value: '14days', label: 'Últimos 14 dias' },
    { value: '30days', label: 'Últimos 30 dias' },
    { value: 'week', label: 'Esta semana' },
    { value: 'month', label: 'Este mês' },
    { value: 'custom', label: 'Período personalizado' },
  ];

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'Todos os status' },
    { value: 'read', label: 'Lida' },
    { value: 'delivered', label: 'Entregue' },
    { value: 'sent', label: 'Enviada' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck className="w-4 h-4 text-primary" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Check className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'read':
        return <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">Lida</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10">Entregue</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground border-border">Enviada</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Filtros</span>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          {/* Date filter */}
          <div className="flex flex-col gap-1.5 min-w-[180px]">
            <Label className="text-xs text-muted-foreground">Período</Label>
            <Select
              value={filters.dateFilter}
              onValueChange={(v) => updateFilter('dateFilter', v as DateFilterType)}
            >
              <SelectTrigger className="h-9 bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateFilterOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom date range */}
          {filters.dateFilter === 'custom' && (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">De</Label>
                <Input
                  type="date"
                  className="h-9 bg-background text-sm w-40"
                  value={filters.customDateFrom || ''}
                  onChange={(e) => updateFilter('customDateFrom', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">Até</Label>
                <Input
                  type="date"
                  className="h-9 bg-background text-sm w-40"
                  value={filters.customDateTo || ''}
                  onChange={(e) => updateFilter('customDateTo', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Status filter */}
          <div className="flex flex-col gap-1.5 min-w-[160px]">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select
              value={filters.statusFilter}
              onValueChange={(v) => updateFilter('statusFilter', v as StatusFilter)}
            >
              <SelectTrigger className="h-9 bg-background text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando conversas...</span>
        </div>
      ) : !conversations || conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Nenhuma conversa encontrada</p>
          <p className="text-sm mt-1">Tente ajustar os filtros ou o período selecionado</p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {conversations.length} conversa{conversations.length !== 1 ? 's' : ''} aguardando resposta
            </p>
          </div>

          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50 hover:bg-card/80 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{conv.contactName}</p>
                  {getStatusBadge(conv.status)}
                </div>
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {conv.lastMessageContent || 'Mensagem enviada'}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(conv.dispatchSentAt), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(conv.dispatchSentAt), 'dd/MM/yyyy', { locale: ptBR })}
                </div>
                {getStatusIcon(conv.status)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
