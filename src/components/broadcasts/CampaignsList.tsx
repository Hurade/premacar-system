import React, { useEffect, useRef, useState } from 'react';
import { useCampaigns, useUpdateCampaign, useDeleteCampaign, useProcessCampaigns, useCampaignLeads, Campaign } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Play, Pause, BarChart3, Pencil, Trash2, PlusCircle, Clock, 
  CheckCircle, Send, Eye, MessageSquare, AlertTriangle, Loader2, Zap, RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface CampaignsListProps {
  onNewCampaign: () => void;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: 'Rascunho', color: 'bg-muted text-muted-foreground', icon: <Pencil className="w-3 h-3" /> },
  active: { label: 'Ativa', color: 'bg-green-500/20 text-green-400', icon: <Play className="w-3 h-3" /> },
  paused: { label: 'Pausada', color: 'bg-yellow-500/20 text-yellow-400', icon: <Pause className="w-3 h-3" /> },
  completed: { label: 'Concluída', color: 'bg-blue-500/20 text-blue-400', icon: <CheckCircle className="w-3 h-3" /> },
  scheduled: { label: 'Agendada', color: 'bg-purple-500/20 text-purple-400', icon: <Clock className="w-3 h-3" /> },
};

// Polling intervals options in seconds
const POLLING_INTERVALS = [
  { value: 10000, label: '10s' },
  { value: 20000, label: '20s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '60s' },
  { value: 120000, label: '2min' },
];

export const BroadcastCampaignsList: React.FC<CampaignsListProps> = ({ onNewCampaign }) => {
  const { data: campaigns, isLoading, refetch } = useCampaigns();
  const updateCampaign = useUpdateCampaign();
  const deleteCampaign = useDeleteCampaign();
  const processCampaigns = useProcessCampaigns();
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(30000);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const { data: selectedLeads } = useCampaignLeads(selectedCampaignId);

  // Check if there are active campaigns
  const hasActiveCampaigns = campaigns?.some(c => c.status === 'active') ?? false;

  // Auto-polling effect
  useEffect(() => {
    if (autoProcessing && hasActiveCampaigns) {
      // Process immediately when enabled
      processCampaigns.mutate();
      
      // Set up interval with configurable time
      pollingRef.current = setInterval(() => {
        if (!processCampaigns.isPending) {
          console.log(`[CampaignsList] Auto-processing campaigns (interval: ${pollingInterval/1000}s)...`);
          processCampaigns.mutate();
        }
      }, pollingInterval);

      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [autoProcessing, hasActiveCampaigns, pollingInterval]);

  // Stop auto-processing when no active campaigns
  useEffect(() => {
    if (!hasActiveCampaigns && autoProcessing) {
      setAutoProcessing(false);
      toast.info('Processamento automático pausado - sem campanhas ativas');
    }
  }, [hasActiveCampaigns, autoProcessing]);

  const handleToggleStatus = async (campaign: Campaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    
    if (newStatus === 'active' && campaign.total_leads === 0) {
      toast.error('Campanha sem leads. Importe leads antes de iniciar.');
      return;
    }

    updateCampaign.mutate({ id: campaign.id, status: newStatus });
    toast.success(newStatus === 'active' ? 'Campanha iniciada!' : 'Campanha pausada.');
  };

  const handleDelete = async (id: string) => {
    deleteCampaign.mutate(id);
  };

  const handleProcessNow = () => {
    processCampaigns.mutate();
  };

  const toggleAutoProcessing = () => {
    if (!autoProcessing) {
      if (!hasActiveCampaigns) {
        toast.error('Nenhuma campanha ativa para processar');
        return;
      }
      setAutoProcessing(true);
      toast.success(`Processamento automático ativado (a cada ${pollingInterval/1000}s)`);
    } else {
      setAutoProcessing(false);
      toast.info('Processamento automático desativado');
    }
  };

  const handleIntervalChange = (newInterval: number) => {
    setPollingInterval(newInterval);
    if (autoProcessing) {
      toast.info(`Intervalo atualizado para ${newInterval/1000}s`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Send className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma campanha criada</h3>
        <p className="text-muted-foreground mb-4">Crie sua primeira campanha de disparo automático</p>
        <Button onClick={onNewCampaign} className="gap-2">
          <PlusCircle className="w-4 h-4" />
          Nova Campanha
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleProcessNow}
            disabled={processCampaigns.isPending || !hasActiveCampaigns}
            className="gap-2"
          >
            {processCampaigns.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            Processar Agora
          </Button>
          
          <Button
            variant={autoProcessing ? "default" : "outline"}
            size="sm"
            onClick={toggleAutoProcessing}
            disabled={!hasActiveCampaigns && !autoProcessing}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${autoProcessing ? 'animate-spin' : ''}`} />
            {autoProcessing ? 'Auto: Ligado' : 'Auto: Desligado'}
          </Button>
          
          {/* Interval selector */}
          <select
            value={pollingInterval}
            onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {POLLING_INTERVALS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        
        <Button onClick={onNewCampaign} className="gap-2">
          <PlusCircle className="w-4 h-4" />
          Nova Campanha
        </Button>
      </div>

      {autoProcessing && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 flex items-center gap-2 text-sm text-emerald-400">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Processamento automático ativo - enviando mensagens a cada {pollingInterval/1000} segundos
        </div>
      )}
      
      {/* Info about automatic cron */}
      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 text-sm text-cyan-400">
        <p className="flex items-center gap-2">
          <Clock className="w-4 h-4" />
          <strong>Novo:</strong> O sistema agora processa campanhas automaticamente a cada 1 minuto via cron, mesmo sem a página aberta!
        </p>
      </div>

      <div className="grid gap-4">
        {campaigns.map((campaign) => {
          const status = statusConfig[campaign.status] || statusConfig.draft;
          const progress = campaign.total_leads > 0 
            ? Math.round((campaign.total_sent / campaign.total_leads) * 100) 
            : 0;

          return (
            <div 
              key={campaign.id} 
              className="bg-card/50 border border-border/50 rounded-xl p-5 hover:border-primary/30 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold text-foreground">{campaign.name}</h3>
                    <Badge className={`${status.color} flex items-center gap-1`}>
                      {status.icon}
                      {status.label}
                    </Badge>
                  </div>
                  {campaign.description && (
                    <p className="text-sm text-muted-foreground">{campaign.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {(campaign.status === 'active' || campaign.status === 'paused') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(campaign)}
                      disabled={updateCampaign.isPending}
                      className="gap-1"
                    >
                      {campaign.status === 'active' ? (
                        <><Pause className="w-4 h-4" /> Pausar</>
                      ) : (
                        <><Play className="w-4 h-4" /> Iniciar</>
                      )}
                    </Button>
                  )}
                  {campaign.status === 'draft' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleStatus(campaign)}
                      disabled={updateCampaign.isPending || campaign.total_leads === 0}
                      className="gap-1"
                    >
                      <Play className="w-4 h-4" /> Iniciar
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => setSelectedCampaignId(campaign.id)}>
                    <BarChart3 className="w-4 h-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. Todos os leads e histórico serão removidos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(campaign.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Progresso</span>
                  <span className="text-foreground font-medium">
                    {campaign.total_sent}/{campaign.total_leads} ({progress}%)
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-4 text-center">
                <div className="flex flex-col">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Send className="w-3 h-3" />
                    <span className="text-xs">Enviadas</span>
                  </div>
                  <span className="text-lg font-semibold text-foreground">{campaign.total_sent}</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <CheckCircle className="w-3 h-3" />
                    <span className="text-xs">Entregues</span>
                  </div>
                  <span className="text-lg font-semibold text-foreground">{campaign.total_delivered}</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <Eye className="w-3 h-3" />
                    <span className="text-xs">Lidas</span>
                  </div>
                  <span className="text-lg font-semibold text-foreground">{campaign.total_read}</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <MessageSquare className="w-3 h-3" />
                    <span className="text-xs">Respondidas</span>
                  </div>
                  <span className="text-lg font-semibold text-foreground">{campaign.total_replied}</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="text-xs">Erros</span>
                  </div>
                  <span className="text-lg font-semibold text-destructive">{campaign.total_errors}</span>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50 text-xs text-muted-foreground">
                <span>
                  Modelo: {campaign.template?.name ?? 'Nenhum selecionado'}
                </span>
                <div className="flex items-center gap-4">
                  {campaign.last_sent_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Último envio: {formatDistanceToNow(new Date(campaign.last_sent_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  )}
                  <span>
                    Criada em {format(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Campaign Stats Dialog */}
      <Dialog open={!!selectedCampaignId} onOpenChange={(open) => !open && setSelectedCampaignId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Estatísticas - {campaigns?.find(c => c.id === selectedCampaignId)?.name}
            </DialogTitle>
          </DialogHeader>
          
          {(() => {
            const campaign = campaigns?.find(c => c.id === selectedCampaignId);
            if (!campaign) return null;
            
            const totalLeads = campaign.total_leads || 0;
            const deliveryRate = campaign.total_sent > 0 ? Math.round((campaign.total_delivered / campaign.total_sent) * 100) : 0;
            const readRate = campaign.total_delivered > 0 ? Math.round((campaign.total_read / campaign.total_delivered) * 100) : 0;
            const replyRate = campaign.total_sent > 0 ? Math.round((campaign.total_replied / campaign.total_sent) * 100) : 0;
            
            // Count lead statuses from actual leads data
            const leadStatusCounts = {
              pending: selectedLeads?.filter(l => l.status === 'pending').length ?? 0,
              sent: selectedLeads?.filter(l => l.status === 'sent').length ?? 0,
              delivered: selectedLeads?.filter(l => l.status === 'delivered').length ?? 0,
              read: selectedLeads?.filter(l => l.status === 'read').length ?? 0,
              replied: selectedLeads?.filter(l => l.status === 'replied').length ?? 0,
              error: selectedLeads?.filter(l => l.status === 'error' || l.status === 'blacklisted').length ?? 0,
            };
            
            return (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-card border border-border rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">Taxa de Entrega</p>
                    <p className="text-3xl font-bold text-foreground">{deliveryRate}%</p>
                    <p className="text-xs text-muted-foreground">{campaign.total_delivered}/{campaign.total_sent}</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">Taxa de Leitura</p>
                    <p className="text-3xl font-bold text-foreground">{readRate}%</p>
                    <p className="text-xs text-muted-foreground">{campaign.total_read}/{campaign.total_delivered}</p>
                  </div>
                  <div className="bg-card border border-border rounded-lg p-4 text-center">
                    <p className="text-sm text-muted-foreground">Taxa de Resposta</p>
                    <p className="text-3xl font-bold text-foreground">{replyRate}%</p>
                    <p className="text-xs text-muted-foreground">{campaign.total_replied}/{campaign.total_sent}</p>
                  </div>
                </div>

                {/* Detailed counters */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-foreground">Contadores da Campanha</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><Send className="w-4 h-4" /> Total de Leads</span>
                      <span className="font-semibold text-foreground">{totalLeads}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><Send className="w-4 h-4" /> Enviadas</span>
                      <span className="font-semibold text-foreground">{campaign.total_sent}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Entregues</span>
                      <span className="font-semibold text-foreground">{campaign.total_delivered}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><Eye className="w-4 h-4" /> Lidas</span>
                      <span className="font-semibold text-foreground">{campaign.total_read}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Respondidas</span>
                      <span className="font-semibold text-foreground">{campaign.total_replied}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-secondary/30 rounded-lg">
                      <span className="text-sm text-muted-foreground flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Erros</span>
                      <span className="font-semibold text-destructive">{campaign.total_errors}</span>
                    </div>
                  </div>
                </div>

                {/* Lead status breakdown from actual data */}
                {selectedLeads && selectedLeads.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Status dos Leads (dados em tempo real)</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <p className="text-2xl font-bold text-foreground">{leadStatusCounts.pending}</p>
                        <p className="text-xs text-muted-foreground">Pendentes</p>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <p className="text-2xl font-bold text-foreground">{leadStatusCounts.sent}</p>
                        <p className="text-xs text-muted-foreground">Enviados</p>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <p className="text-2xl font-bold text-foreground">{leadStatusCounts.delivered}</p>
                        <p className="text-xs text-muted-foreground">Entregues</p>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <p className="text-2xl font-bold text-foreground">{leadStatusCounts.read}</p>
                        <p className="text-xs text-muted-foreground">Lidos</p>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <p className="text-2xl font-bold text-foreground">{leadStatusCounts.replied}</p>
                        <p className="text-xs text-muted-foreground">Responderam</p>
                      </div>
                      <div className="text-center p-3 bg-secondary/30 rounded-lg">
                        <p className="text-2xl font-bold text-destructive">{leadStatusCounts.error}</p>
                        <p className="text-xs text-muted-foreground">Erros</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Campaign info */}
                <div className="space-y-2 text-sm text-muted-foreground border-t border-border pt-4">
                  <p><strong>API:</strong> {campaign.api_source === 'meta' ? 'Meta (WhatsApp Business)' : 'Evolution API'}</p>
                  <p><strong>Limite diário:</strong> {campaign.daily_limit} msgs/dia</p>
                  <p><strong>Enviadas hoje:</strong> {campaign.sent_today}</p>
                  {campaign.last_sent_at && (
                    <p><strong>Último envio:</strong> {format(new Date(campaign.last_sent_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                  )}
                  <p><strong>Criada em:</strong> {format(new Date(campaign.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};
