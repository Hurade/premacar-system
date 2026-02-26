import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, BarChart3, Pause, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { RecurringCampaign } from '@/hooks/useRecurringCampaigns';

interface CampaignCardProps {
  campaign: RecurringCampaign;
  onToggleStatus: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}

const STATUS_CONFIG: Record<string, { icon: string; label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { icon: '🟢', label: 'Ativa', variant: 'default' },
  paused: { icon: '🟡', label: 'Pausada', variant: 'secondary' },
  completed: { icon: '⚪', label: 'Finalizada', variant: 'outline' },
  draft: { icon: '📝', label: 'Rascunho', variant: 'outline' },
};

export function CampaignCard({ campaign, onToggleStatus, onDelete }: CampaignCardProps) {
  const config = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
  const total = campaign.total_contacts || 1;
  const completed = campaign.success_count + campaign.failed_count;
  const progress = Math.min((completed / total) * 100, 100);
  const successRate = total > 0 ? ((campaign.success_count / total) * 100).toFixed(1) : '0';

  const flowDays = campaign.flow_config && typeof campaign.flow_config === 'object'
    ? Object.keys(campaign.flow_config).length
    : 0;

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-5 hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-lg">{config.icon}</span>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{campaign.name}</h3>
            <Badge variant={config.variant} className="mt-1 text-[10px]">
              {config.label}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <BarChart3 className="w-4 h-4" />
          </Button>
          {campaign.status === 'active' ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleStatus(campaign.id, campaign.status)}>
              <Pause className="w-4 h-4" />
            </Button>
          ) : campaign.status === 'paused' ? (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onToggleStatus(campaign.id, campaign.status)}>
              <Play className="w-4 h-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(campaign.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Info */}
      <p className="text-xs text-muted-foreground mb-3">
        Criada em: {new Date(campaign.created_at).toLocaleDateString('pt-BR')}
        {flowDays > 0 && ` | Duração: ${flowDays} dias`}
      </p>

      {/* Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Progresso</span>
          <span>{completed}/{total} ({progress.toFixed(0)}%)</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-green-400">
          ✅ Sucesso: {campaign.success_count} ({successRate}%)
        </span>
        <span className="text-red-400">
          ❌ Falha: {campaign.failed_count}
        </span>
        <span className="text-muted-foreground">
          🔄 Em progresso: {campaign.in_progress_count}
        </span>
      </div>
    </div>
  );
}
