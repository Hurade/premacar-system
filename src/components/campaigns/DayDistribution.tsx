import React from 'react';
import { RecurringCampaign } from '@/hooks/useRecurringCampaigns';

const CHANNEL_CONFIG: Record<string, { icon: string; label: string }> = {
  call: { icon: '📞', label: 'Ligação' },
  whatsapp: { icon: '💬', label: 'WhatsApp' },
  email: { icon: '📧', label: 'Email' },
  sms: { icon: '📱', label: 'SMS' },
  finalize: { icon: '🏁', label: 'Finalização' },
};

interface Props {
  campaign: RecurringCampaign;
}

export function DayDistribution({ campaign }: Props) {
  const flowConfig = campaign.flow_config as Record<string, any> | null;
  if (!flowConfig || typeof flowConfig !== 'object') return null;

  const days = Object.entries(flowConfig).sort(([a], [b]) => {
    const numA = parseInt(a.replace('day', ''));
    const numB = parseInt(b.replace('day', ''));
    return numA - numB;
  });

  if (days.length === 0) return null;

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">📋 Distribuição por Dia</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {days.map(([dayKey, dayConfig]) => {
          const dayNum = dayKey.replace('day', '');
          const channel = CHANNEL_CONFIG[dayConfig?.type] || { icon: '❓', label: dayConfig?.type || 'Desconhecido' };

          return (
            <div
              key={dayKey}
              className={`border rounded-lg p-4 transition-colors ${
                dayConfig?.enabled !== false
                  ? 'border-border/50 bg-secondary/20'
                  : 'border-border/30 bg-secondary/5 opacity-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{channel.icon}</span>
                <span className="font-semibold text-sm text-foreground">
                  DIA {dayNum} — {channel.label}
                </span>
              </div>

              {dayConfig?.timing && (
                <p className="text-xs text-muted-foreground mb-2">
                  {dayConfig.timing.type === 'range'
                    ? `Entre ${dayConfig.timing.start} e ${dayConfig.timing.end}`
                    : dayConfig.timing.type === 'delay'
                    ? `${dayConfig.timing.hours}h após dia anterior`
                    : 'Automático'}
                </p>
              )}

              {dayConfig?.config?.template && (
                <p className="text-xs text-muted-foreground">
                  Template: <span className="text-foreground">{dayConfig.config.template}</span>
                </p>
              )}

              {dayConfig?.successConditions?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {dayConfig.successConditions.map((c: any, i: number) => (
                    <span key={i} className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">
                      {c.tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
