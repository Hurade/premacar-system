import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface BreakdownRow {
  day_key: string;
  channel: string;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  bounced_count: number;
  complained_count: number;
}

interface Props {
  campaignId: string;
}

const CHANNEL_LABEL: Record<string, string> = { whatsapp: '💬 WhatsApp', email: '📧 E-mail' };

export function CampaignDeliveryBreakdown({ campaignId }: Props) {
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [breakdownResult, blockedResult] = await Promise.all([
          supabase
            .from('campaign_delivery_breakdown')
            .select('*')
            .eq('campaign_id', campaignId),
          supabase
            .from('campaign_contacts')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaignId)
            .eq('status', 'cancelled'),
        ]);

        if (breakdownResult.error) throw breakdownResult.error;

        const sorted = ((breakdownResult.data as BreakdownRow[]) || []).sort((a, b) => {
          const na = parseInt(a.day_key.replace('day', ''), 10) || 0;
          const nb = parseInt(b.day_key.replace('day', ''), 10) || 0;
          if (na !== nb) return na - nb;
          return a.channel.localeCompare(b.channel);
        });

        setRows(sorted);
        setBlockedCount(blockedResult.count || 0);
      } catch (e) {
        console.error('Erro ao buscar detalhamento de envios:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [campaignId]);

  if (loading) {
    return <div className="bg-card/50 border border-border/50 rounded-xl p-6 h-32 animate-pulse" />;
  }

  if (rows.length === 0 && blockedCount === 0) {
    return (
      <div className="bg-card/50 border border-border/50 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">📊 Detalhamento dos Envios</h2>
        <p className="text-sm text-muted-foreground">Nenhum envio registrado ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">📊 Detalhamento dos Envios</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border/50">
              <th className="py-2 pr-4 font-medium">Dia</th>
              <th className="py-2 pr-4 font-medium">Canal</th>
              <th className="py-2 pr-4 font-medium text-right">Enviados</th>
              <th className="py-2 pr-4 font-medium text-right">Entregues</th>
              <th className="py-2 pr-4 font-medium text-right">Lidos</th>
              <th className="py-2 pr-4 font-medium text-right">Falhas</th>
              {rows.some(r => r.bounced_count > 0) && (
                <th className="py-2 pr-4 font-medium text-right">Rejeitados</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((r) => (
              <tr key={`${r.day_key}-${r.channel}`}>
                <td className="py-2 pr-4 text-foreground">Dia {r.day_key.replace('day', '')}</td>
                <td className="py-2 pr-4 text-foreground">{CHANNEL_LABEL[r.channel] || r.channel}</td>
                <td className="py-2 pr-4 text-right text-foreground">{r.sent_count}</td>
                <td className="py-2 pr-4 text-right text-muted-foreground">
                  {r.channel === 'whatsapp' ? r.delivered_count : '—'}
                </td>
                <td className="py-2 pr-4 text-right text-muted-foreground">
                  {r.channel === 'whatsapp' ? r.read_count : '—'}
                </td>
                <td className="py-2 pr-4 text-right text-destructive">{r.failed_count}</td>
                {rows.some(x => x.bounced_count > 0) && (
                  <td className="py-2 pr-4 text-right text-destructive">{r.bounced_count}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {blockedCount > 0 && (
        <p className="text-xs text-muted-foreground mt-4">
          🚫 <span className="font-medium text-foreground">{blockedCount}</span> contato(s) bloqueado(s) durante a campanha (opt-out, número inválido ou blacklist) — não contam nos envios acima.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground mt-3">
        "Entregue"/"Lido" só existe para WhatsApp (Meta/Evolution confirmam via webhook). E-mail mostra só Enviados/Falhas
        {' '}por enquanto — rastreio de entrega/rejeição de e-mail depende de um tópico SNS configurado na AWS.
      </p>
    </div>
  );
}
