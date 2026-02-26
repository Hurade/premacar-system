import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pause, Play, Download, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { RecurringCampaign } from '@/hooks/useRecurringCampaigns';
import { CampaignDetailMetrics } from '@/components/campaigns/CampaignDetailMetrics';
import { CampaignFunnel } from '@/components/campaigns/CampaignFunnel';
import { DayDistribution } from '@/components/campaigns/DayDistribution';
import { CampaignContactsList } from '@/components/campaigns/CampaignContactsList';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Ativa', variant: 'default' },
  paused: { label: 'Pausada', variant: 'secondary' },
  completed: { label: 'Finalizada', variant: 'outline' },
  draft: { label: 'Rascunho', variant: 'outline' },
};

const CampaignDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<RecurringCampaign | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCampaign = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('recurring_campaigns')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      setCampaign(data as any);
    } catch (error) {
      console.error('Erro ao buscar campanha:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  const handleToggleStatus = async () => {
    if (!campaign || !id) return;
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase
      .from('recurring_campaigns')
      .update({ status: newStatus } as any)
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      toast.success(`Campanha ${newStatus === 'active' ? 'retomada' : 'pausada'}`);
      fetchCampaign();
    }
  };

  const handleExport = async () => {
    if (!id || !campaign) return;
    try {
      const { data: contacts, error } = await supabase
        .from('campaign_contacts')
        .select('*, contacts(name, phone_number, email)')
        .eq('campaign_id', id);

      if (error) throw error;

      const rows = (contacts || []).map((c: any) => [
        c.contacts?.name || '',
        c.contacts?.phone_number || '',
        c.contacts?.email || '',
        c.status || '',
        c.current_day || '',
        c.failed_reason || '',
      ].join(','));

      const csv = ['Nome,Telefone,Email,Status,Dia Atual,Motivo Falha', ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campanha_${campaign.name.replace(/\s+/g, '_')}_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('CSV exportado com sucesso');
    } catch {
      toast.error('Erro ao exportar');
    }
  };

  if (loading) {
    return (
      <div className="h-full overflow-y-auto p-6 space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-card/50 border border-border/50 rounded-xl h-40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground opacity-30" />
          <p className="text-lg font-medium text-muted-foreground">Campanha não encontrada</p>
          <Button variant="outline" onClick={() => navigate('/campanhas')}>Voltar</Button>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/campanhas')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{campaign.name}</h1>
              <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
            </div>
            {campaign.description && (
              <p className="text-sm text-muted-foreground mt-1">{campaign.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
            <Download className="w-4 h-4" />
            Exportar CSV
          </Button>
          {(campaign.status === 'active' || campaign.status === 'paused') && (
            <Button
              variant={campaign.status === 'active' ? 'secondary' : 'default'}
              size="sm"
              className="gap-2"
              onClick={handleToggleStatus}
            >
              {campaign.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {campaign.status === 'active' ? 'Pausar' : 'Retomar'}
            </Button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <CampaignDetailMetrics campaign={campaign} />

      {/* Funnel */}
      <CampaignFunnel campaignId={campaign.id} />

      {/* Day Distribution */}
      <DayDistribution campaign={campaign} />

      {/* Contacts */}
      <CampaignContactsList campaignId={campaign.id} />
    </div>
  );
};

export default CampaignDetailsPage;
