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

interface ErrorRow {
  error: string;
  count: number;
}

interface Props {
  campaignId: string;
}

const CHANNEL_LABEL: Record<string, string> = { whatsapp: '💬 WhatsApp', email: '📧 E-mail' };

function pct(n: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((n / total) * 1000) / 10;
}

function PctBadge({ value, good = 60, warn = 30 }: { value: number | null; good?: number; warn?: number }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  const color = value >= good ? 'text-emerald-400' : value >= warn ? 'text-amber-400' : 'text-destructive';
  return <span className={color}>{value}%</span>;
}

function StatCard({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: 'danger' | 'default' }) {
  return (
    <div className="bg-background/40 border border-border/40 rounded-lg px-4 py-3 min-w-[120px]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${tone === 'danger' ? 'text-destructive' : 'text-foreground'}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function CampaignDeliveryBreakdown({ campaignId }: Props) {
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [errors, setErrors] = useState<ErrorRow[]>([]);
  const [blockedCount, setBlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [breakdownResult, blockedResult, errorsResult] = await Promise.all([
          supabase
            .from('campaign_delivery_breakdown')
            .select('*')
            .eq('campaign_id', campaignId),
          supabase
            .from('campaign_contacts')
            .select('id', { count: 'exact', head: true })
            .eq('campaign_id', campaignId)
            .eq('status', 'cancelled'),
          supabase
            .from('campaign_message_events')
            .select('error')
            .eq('campaign_id', campaignId)
            .not('error', 'is', null),
        ]);

        if (breakdownResult.error) throw breakdownResult.error;

        const sorted = ((breakdownResult.data as BreakdownRow[]) || []).sort((a, b) => {
          const na = parseInt(a.day_key.replace('day', ''), 10) || 0;
          const nb = parseInt(b.day_key.replace('day', ''), 10) || 0;
          if (na !== nb) return na - nb;
          return a.channel.localeCompare(b.channel);
        });

        // Agrupa os erros crus (um texto por envio falho) em motivos únicos,
        // ordenado do mais frequente pro menos — é isso que diz pra gestão
        // "o que está quebrado", em vez de só um número de falhas sem causa.
        const errorCounts = new Map<string, number>();
        for (const row of (errorsResult.data as { error: string }[]) || []) {
          errorCounts.set(row.error, (errorCounts.get(row.error) || 0) + 1);
        }
        const errorRows = Array.from(errorCounts.entries())
          .map(([error, count]) => ({ error, count }))
          .sort((a, b) => b.count - a.count);

        setRows(sorted);
        setErrors(errorRows);
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

  // Totais da campanha inteira — por canal, porque "entregue"/"lido" só
  // existe pra WhatsApp e misturar os dois no mesmo total distorceria a taxa.
  const totalsByChannel = rows.reduce((acc, r) => {
    const t = acc[r.channel] || { sent: 0, delivered: 0, read: 0, failed: 0, bounced: 0 };
    t.sent += r.sent_count;
    t.delivered += r.delivered_count;
    t.read += r.read_count;
    t.failed += r.failed_count;
    t.bounced += r.bounced_count;
    acc[r.channel] = t;
    return acc;
  }, {} as Record<string, { sent: number; delivered: number; read: number; failed: number; bounced: number }>);

  const totalSent = rows.reduce((a, r) => a + r.sent_count, 0);
  const totalFailed = rows.reduce((a, r) => a + r.failed_count, 0);
  const totalBounced = rows.reduce((a, r) => a + r.bounced_count, 0);
  const wa = totalsByChannel.whatsapp;

  return (
    <div className="bg-card/50 border border-border/50 rounded-xl p-6 space-y-5">
      <h2 className="text-lg font-semibold text-foreground">📊 Detalhamento dos Envios</h2>

      {/* Resumo da campanha inteira — primeiro o que a gestão quer ver de
          cara: quanto saiu, que fração virou resultado de verdade e que
          fração deu problema. */}
      <div className="flex flex-wrap gap-3">
        <StatCard label="Total Enviado" value={totalSent} />
        {wa && (
          <>
            <StatCard label="Entregues (WhatsApp)" value={wa.delivered} sub={`${pct(wa.delivered, wa.sent) ?? 0}% dos enviados`} />
            <StatCard label="Lidos (WhatsApp)" value={wa.read} sub={`${pct(wa.read, wa.sent) ?? 0}% dos enviados`} />
          </>
        )}
        <StatCard label="Falhas" value={totalFailed} sub={totalSent > 0 ? `${pct(totalFailed, totalSent)}% dos enviados` : undefined} tone={totalFailed > 0 ? 'danger' : 'default'} />
        {totalBounced > 0 && <StatCard label="Rejeitados" value={totalBounced} tone="danger" />}
        <StatCard label="Bloqueados" value={blockedCount} sub="opt-out, inválido ou blacklist" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border/50">
              <th className="py-2 pr-4 font-medium">Dia</th>
              <th className="py-2 pr-4 font-medium">Canal</th>
              <th className="py-2 pr-4 font-medium text-right">Enviados</th>
              <th className="py-2 pr-4 font-medium text-right">Entregues</th>
              <th className="py-2 pr-4 font-medium text-right">% Entrega</th>
              <th className="py-2 pr-4 font-medium text-right">Lidos</th>
              <th className="py-2 pr-4 font-medium text-right">% Leitura</th>
              <th className="py-2 pr-4 font-medium text-right">Falhas</th>
              {rows.some(r => r.bounced_count > 0) && (
                <th className="py-2 pr-4 font-medium text-right">Rejeitados</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30">
            {rows.map((r) => {
              const isWhatsapp = r.channel === 'whatsapp';
              return (
                <tr key={`${r.day_key}-${r.channel}`}>
                  <td className="py-2 pr-4 text-foreground">Dia {r.day_key.replace('day', '')}</td>
                  <td className="py-2 pr-4 text-foreground">{CHANNEL_LABEL[r.channel] || r.channel}</td>
                  <td className="py-2 pr-4 text-right text-foreground">{r.sent_count}</td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">
                    {isWhatsapp ? r.delivered_count : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {isWhatsapp ? <PctBadge value={pct(r.delivered_count, r.sent_count)} /> : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right text-muted-foreground">
                    {isWhatsapp ? r.read_count : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right">
                    {isWhatsapp ? <PctBadge value={pct(r.read_count, r.sent_count)} good={30} warn={10} /> : '—'}
                  </td>
                  <td className="py-2 pr-4 text-right text-destructive">{r.failed_count}</td>
                  {rows.some(x => x.bounced_count > 0) && (
                    <td className="py-2 pr-4 text-right text-destructive">{r.bounced_count}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Motivos de falha — sem isso, "22 falhas" não diz se é um problema
          de configuração que dá pra corrigir (ex: template com parâmetro
          errado) ou são números inválidos que não tem o que fazer. */}
      {errors.length > 0 && (
        <div className="border-t border-border/40 pt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Principais Motivos de Falha</p>
          <div className="space-y-1.5">
            {errors.slice(0, 6).map(e => (
              <div key={e.error} className="flex items-start justify-between gap-3 text-xs">
                <span className="text-foreground/90 flex-1">{e.error}</span>
                <span className="text-destructive font-medium shrink-0">{e.count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {blockedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          🚫 <span className="font-medium text-foreground">{blockedCount}</span> contato(s) bloqueado(s) durante a campanha (opt-out, número inválido ou blacklist) — não contam nos envios acima.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        "Entregue"/"Lido" só existe para WhatsApp (Meta/Evolution confirmam via webhook). E-mail mostra só Enviados/Falhas
        {' '}por enquanto — rastreio de entrega/rejeição de e-mail depende de um tópico SNS configurado na AWS.
      </p>
    </div>
  );
}
