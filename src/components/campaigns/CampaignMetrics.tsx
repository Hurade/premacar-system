import React from 'react';
import { Target, MessageSquare, CheckCircle2, DollarSign } from 'lucide-react';
import { useRecurringCampaignStats } from '@/hooks/useRecurringCampaigns';

const MetricCard = ({ icon: Icon, label, value, iconColor }: { icon: any; label: string; value: string; iconColor: string }) => (
  <div className="bg-card/50 border border-border/50 rounded-xl p-4 flex items-center gap-4">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColor}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  </div>
);

export function CampaignMetrics() {
  const { stats, loading } = useRecurringCampaignStats();

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-card/50 border border-border/50 rounded-xl p-4 h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard icon={Target} label="Campanhas Ativas" value={String(stats.active_campaigns)} iconColor="bg-primary/20 text-primary" />
      <MetricCard icon={MessageSquare} label="Contatos Ativos" value={String(stats.active_contacts)} iconColor="bg-accent/20 text-accent" />
      <MetricCard icon={CheckCircle2} label="Taxa de Sucesso" value={`${stats.success_rate}%`} iconColor="bg-green-500/20 text-green-400" />
      <MetricCard icon={DollarSign} label="Custo Total" value={`R$ ${(stats.total_cost / 1000).toFixed(1)}k`} iconColor="bg-yellow-500/20 text-yellow-400" />
    </div>
  );
}
