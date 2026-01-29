import React, { useState } from 'react';
import { useLeadsHistory, useCampaigns } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, Search, CheckCircle, AlertTriangle, MessageSquare, Send, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: 'Pendente', color: 'bg-muted text-muted-foreground', icon: null },
  sent: { label: 'Enviado', color: 'bg-blue-500/20 text-blue-400', icon: <Send className="w-3 h-3" /> },
  delivered: { label: 'Entregue', color: 'bg-green-500/20 text-green-400', icon: <CheckCircle className="w-3 h-3" /> },
  read: { label: 'Lido', color: 'bg-cyan-500/20 text-cyan-400', icon: <Eye className="w-3 h-3" /> },
  replied: { label: 'Respondido', color: 'bg-purple-500/20 text-purple-400', icon: <MessageSquare className="w-3 h-3" /> },
  error: { label: 'Erro', color: 'bg-destructive/20 text-destructive', icon: <AlertTriangle className="w-3 h-3" /> },
  blacklisted: { label: 'Bloqueado', color: 'bg-yellow-500/20 text-yellow-400', icon: <AlertTriangle className="w-3 h-3" /> },
};

// Mask phone number for privacy
const maskPhone = (phone: string): string => {
  if (phone.length < 8) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-4);
};

export const BroadcastHistory: React.FC = () => {
  const { data: campaigns } = useCampaigns();
  const [filters, setFilters] = useState({
    campaignId: '',
    startDate: '',
    endDate: '',
    status: 'all',
  });

  const { data: leads, isLoading } = useLeadsHistory(filters);

  // Export to Excel
  const exportToExcel = (onlyReplied = false) => {
    if (!leads) return;

    const dataToExport = onlyReplied 
      ? leads.filter(l => l.status === 'replied')
      : leads;

    const rows = dataToExport.map(lead => ({
      'Data/Hora': lead.sent_at ? format(new Date(lead.sent_at), 'dd/MM/yyyy HH:mm') : '-',
      'Campanha': (lead as any).campaign?.name ?? '-',
      'Telefone': lead.phone,
      'Nome': lead.name ?? '-',
      'Status': statusConfig[lead.status]?.label ?? lead.status,
      'Variação': lead.variation_used != null ? lead.variation_used + 1 : '-',
      'Respondido em': lead.replied_at ? format(new Date(lead.replied_at), 'dd/MM/yyyy HH:mm') : '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Histórico');
    
    const filename = onlyReplied 
      ? `respondentes_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
      : `historico_disparos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Campanha</Label>
            <Select
              value={filters.campaignId}
              onValueChange={(value) => setFilters(prev => ({ ...prev, campaignId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas</SelectItem>
                {campaigns?.map(campaign => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Data Início</Label>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Data Fim</Label>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="delivered">Entregues</SelectItem>
                <SelectItem value="read">Lidos</SelectItem>
                <SelectItem value="replied">Respondidos</SelectItem>
                <SelectItem value="error">Erros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={() => exportToExcel(false)} className="gap-1">
              <Download className="w-3 h-3" />
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportToExcel(true)} className="gap-1">
              <Download className="w-3 h-3" />
              Respondentes
            </Button>
          </div>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : !leads || leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Search className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum envio encontrado</h3>
          <p className="text-muted-foreground">Ajuste os filtros ou aguarde o processamento das campanhas</p>
        </div>
      ) : (
        <div className="bg-card/50 border border-border/50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/50 bg-secondary/30">
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground">Data/Hora</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground">Campanha</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground">Telefone</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground">Nome</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground">Variação</th>
                  <th className="text-left p-4 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const status = statusConfig[lead.status] || statusConfig.pending;
                  
                  return (
                    <tr key={lead.id} className="border-b border-border/30 hover:bg-secondary/20">
                      <td className="p-4 text-sm text-foreground">
                        {lead.sent_at 
                          ? format(new Date(lead.sent_at), "dd/MM/yy HH:mm", { locale: ptBR })
                          : '-'
                        }
                      </td>
                      <td className="p-4 text-sm text-foreground">
                        {(lead as any).campaign?.name ?? '-'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground font-mono">
                        {maskPhone(lead.phone)}
                      </td>
                      <td className="p-4 text-sm text-foreground">
                        {lead.name ?? '-'}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {lead.variation_used != null ? `#${lead.variation_used + 1}` : '-'}
                      </td>
                      <td className="p-4">
                        <Badge className={`${status.color} flex items-center gap-1 w-fit`}>
                          {status.icon}
                          {status.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-4 border-t border-border/50 text-sm text-muted-foreground">
            Mostrando {leads.length} registros
          </div>
        </div>
      )}
    </div>
  );
};
