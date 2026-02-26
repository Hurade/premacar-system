import React from 'react';
import { RecurringCampaign } from '@/hooks/useRecurringCampaigns';

interface Props {
  campaign: RecurringCampaign;
}

export function CampaignDetailMetrics({ campaign }: Props) {
  const total = campaign.total_contacts || 1;
  const successRate = ((campaign.success_count / total) * 100).toFixed(1);
  const failRate = ((campaign.failed_count / total) * 100).toFixed(1);
  const progressRate = ((campaign.in_progress_count / total) * 100).toFixed(1);
  const costPerLead = total > 0 ? (campaign.actual_cost / total).toFixed(2) : '0.00';

  const metrics = [
    { label: '👥 Total de Contatos', value: campaign.total_contacts, sub: '' },
    { label: '🔄 Em Andamento', value: campaign.in_progress_count, sub: `${progressRate}%` },
    { label: '✅ Sucesso', value: campaign.success_count, sub: `${successRate}%` },
    { label: '❌ Falha', value: campaign.failed_count, sub: `${failRate}%` },
    { label: '💰 Custo Total', value: `R$ ${campaign.actual_cost?.toFixed(2) || '0.00'}`, sub: `R$ ${costPerLead}/lead` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {metrics.map((m) => (
        <div key={m.label} className="bg-card/50 border border-border/50 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{m.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
          {m.sub && <p className="text-xs text-primary mt-0.5">{m.sub}</p>}
        </div>
      ))}
    </div>
  );
}
