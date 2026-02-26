import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface FunnelStage {
  label: string;
  icon: string;
  count: number;
}

interface Props {
  campaignId: string;
}

export function CampaignFunnel({ campaignId }: Props) {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_campaign_funnel', {
          p_campaign_id: campaignId,
        });
        if (error) throw error;
        setStages((data as any) || []);
      } catch (e) {
        console.error('Erro ao buscar funil:', e);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [campaignId]);

  if (loading) {
    return <div className="bg-card/50 border border-border/50 rounded-xl p-6 h-48 animate-pulse" />;
  }

  const maxCount = stages[0]?.count || 1;

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-6">📈 Funil de Conversão</h2>

      <div className="space-y-3">
        {stages.map((stage, i) => {
          const pct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
          const width = Math.max(pct, 8);

          return (
            <div key={i}>
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="text-muted-foreground">
                  {stage.icon} {stage.label}
                </span>
                <span className="font-medium text-foreground">
                  {stage.count} <span className="text-muted-foreground text-xs">({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-7 bg-secondary/30 rounded-lg overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-lg flex items-center justify-end pr-2 transition-all duration-500"
                  style={{ width: `${width}%` }}
                >
                  <span className="text-[10px] font-bold text-primary-foreground">{stage.count}</span>
                </div>
              </div>
              {i < stages.length - 1 && stages[i].count > 0 && (
                <p className="text-[10px] text-muted-foreground text-right mt-0.5">
                  Drop-off: {stages[i].count - stages[i + 1].count} ({((1 - stages[i + 1].count / stages[i].count) * 100).toFixed(1)}%)
                </p>
              )}
            </div>
          );
        })}
      </div>

      {stages.length >= 2 && stages[0].count > 0 && (
        <div className="mt-4 pt-4 border-t border-border/50 text-center">
          <span className="text-sm text-muted-foreground">Taxa de Conversão Final: </span>
          <span className="text-lg font-bold text-primary">
            {((stages[stages.length - 1].count / stages[0].count) * 100).toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}
