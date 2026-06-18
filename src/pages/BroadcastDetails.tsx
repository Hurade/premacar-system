import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Pause, Play, FlaskConical, Shield, BarChart3, Send, CheckCircle, MessageSquare, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Campaign } from '@/hooks/useCampaigns';
import CampaignVariations from '@/components/campaigns/CampaignVariations';
import CampaignSendRules from '@/components/campaigns/CampaignSendRules';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  active:    { label: 'Ativa',      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  paused:    { label: 'Pausada',    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  completed: { label: 'Finalizada', color: 'bg-slate-700 text-slate-300' },
  draft:     { label: 'Rascunho',   color: 'bg-slate-700 text-slate-300' },
  scheduled: { label: 'Agendada',   color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
};

const MetricCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; sub?: string }> = ({
  icon, label, value, sub,
}) => (
  <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
    <div className="flex items-center gap-2 text-slate-400 mb-1">
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
    {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
  </div>
);

const BroadcastDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCampaign = async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('campaigns')
      .select('*, template:message_templates(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) { toast.error('Erro ao carregar campanha'); }
    else { setCampaign(data as Campaign); }
    setLoading(false);
  };

  useEffect(() => { fetchCampaign(); }, [id]);

  const handleToggleStatus = async () => {
    if (!campaign || !id) return;
    const newStatus = campaign.status === 'active' ? 'paused' : 'active';
    const { error } = await supabase.from('campaigns').update({ status: newStatus }).eq('id', id);
    if (error) { toast.error('Erro ao atualizar status'); return; }
    toast.success(newStatus === 'active' ? 'Campanha retomada' : 'Campanha pausada');
    fetchCampaign();
  };

  if (loading) return (
    <div className="h-full flex items-center justify-center">
      <Loader2 className="w-7 h-7 animate-spin text-cyan-500" />
    </div>
  );

  if (!campaign) return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <BarChart3 className="w-12 h-12 mx-auto text-slate-600" />
        <p className="text-slate-400">Campanha não encontrada</p>
        <Button variant="outline" onClick={() => navigate('/broadcasts')}>Voltar</Button>
      </div>
    </div>
  );

  const statusCfg = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
  const deliveryRate = campaign.total_sent > 0
    ? Math.round((campaign.total_delivered / campaign.total_sent) * 100)
    : 0;
  const replyRate = campaign.total_sent > 0
    ? Math.round((campaign.total_replied / campaign.total_sent) * 100)
    : 0;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/broadcasts')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{campaign.name}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                API Oficial Meta
              </span>
            </div>
            {campaign.description && (
              <p className="text-sm text-slate-400 mt-1">{campaign.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(campaign.status === 'active' || campaign.status === 'paused') && (
            <Button
              variant={campaign.status === 'active' ? 'secondary' : 'default'}
              size="sm"
              className="gap-2"
              onClick={handleToggleStatus}
            >
              {campaign.status === 'active'
                ? <><Pause className="w-4 h-4" /> Pausar</>
                : <><Play className="w-4 h-4" /> Retomar</>
              }
            </Button>
          )}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <MetricCard icon={<Send className="w-3.5 h-3.5" />} label="Total Leads" value={campaign.total_leads} />
        <MetricCard icon={<Send className="w-3.5 h-3.5" />} label="Enviados Hoje" value={campaign.sent_today} sub={`de ${campaign.daily_limit} limite`} />
        <MetricCard icon={<Send className="w-3.5 h-3.5" />} label="Total Enviados" value={campaign.total_sent} />
        <MetricCard icon={<CheckCircle className="w-3.5 h-3.5" />} label="Entregues" value={campaign.total_delivered} sub={`${deliveryRate}% entrega`} />
        <MetricCard icon={<MessageSquare className="w-3.5 h-3.5" />} label="Respostas" value={campaign.total_replied} sub={`${replyRate}% resposta`} />
        <MetricCard icon={<AlertTriangle className="w-3.5 h-3.5" />} label="Erros" value={campaign.total_errors} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="ab">
        <TabsList className="bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="ab" className="gap-1.5">
            <FlaskConical className="w-3.5 h-3.5" />
            Teste A/B
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Regras de Envio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ab" className="mt-4">
          <CampaignVariations campaignId={campaign.id} campaignName={campaign.name} />
        </TabsContent>

        <TabsContent value="rules" className="mt-4">
          <CampaignSendRules campaignId={campaign.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BroadcastDetails;
