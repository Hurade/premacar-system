import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Pencil, Trash2, Loader2, FlaskConical, RotateCcw, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  CampaignVariation,
  useCampaignVariations,
  useUpsertVariation,
  useDeleteVariation,
  useSelectWinner,
  useClearWinner,
  deliveryRate,
  readRate,
  replyRate,
} from '@/hooks/useCampaignVariations';

const LABELS = ['A', 'B', 'C', 'D'];
const METRIC_COLORS = ['bg-cyan-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500'];

interface VariationModalProps {
  campaignId: string;
  existing: CampaignVariation | null;
  usedLabels: string[];
  onClose: () => void;
}

const VariationModal: React.FC<VariationModalProps> = ({ campaignId, existing, usedLabels, onClose }) => {
  const upsert = useUpsertVariation();
  const [templates, setTemplates] = useState<{ id: string; display_name: string; name: string; body_text: string }[]>([]);
  const [form, setForm] = useState({
    label: existing?.label ?? LABELS.find(l => !usedLabels.includes(l)) ?? 'A',
    name: existing?.name ?? '',
    weight: existing?.weight ?? 50,
    meta_template_id: existing?.meta_template_id ?? '',
  });

  useEffect(() => {
    supabase
      .from('meta_templates')
      .select('id, display_name, name, body_text')
      .eq('status', 'approved')
      .order('display_name')
      .then(({ data }) => setTemplates(data ?? []));
  }, []);

  const handleSave = async () => {
    if (!form.meta_template_id) { toast.error('Selecione um template'); return; }
    await upsert.mutateAsync({
      ...(existing ? { id: existing.id } : {}),
      campaign_id: campaignId,
      label: form.label,
      name: form.name || `Variação ${form.label}`,
      weight: form.weight,
      meta_template_id: form.meta_template_id,
    });
    onClose();
  };

  const selectedTemplate = templates.find(t => t.id === form.meta_template_id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle>{existing ? 'Editar Variação' : 'Nova Variação'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300 text-xs mb-1.5 block">Rótulo</Label>
              <div className="flex gap-1.5">
                {LABELS.map(l => (
                  <button
                    key={l}
                    disabled={!existing && usedLabels.includes(l)}
                    onClick={() => setForm(f => ({ ...f, label: l }))}
                    className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                      form.label === l
                        ? 'bg-cyan-500 text-white ring-2 ring-cyan-400'
                        : usedLabels.includes(l) && l !== existing?.label
                        ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-slate-300 text-xs mb-1.5 block">Peso (%)</Label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: Number(e.target.value) }))}
                  className="flex-1 accent-cyan-500"
                />
                <span className="text-white font-bold w-10 text-right">{form.weight}%</span>
              </div>
            </div>
          </div>

          <div>
            <Label className="text-slate-300 text-xs mb-1.5 block">Nome amigável</Label>
            <Input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={`Variação ${form.label}`}
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div>
            <Label className="text-slate-300 text-xs mb-1.5 block">Template Meta (aprovado)</Label>
            <select
              value={form.meta_template_id}
              onChange={e => setForm(f => ({ ...f, meta_template_id: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Selecionar template…</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.display_name || t.name}</option>
              ))}
            </select>
            {templates.length === 0 && (
              <p className="text-xs text-amber-400 mt-1">Nenhum template aprovado encontrado. Cadastre em Configurações → Templates.</p>
            )}
          </div>

          {selectedTemplate && (
            <div className="rounded-lg bg-slate-800/60 border border-slate-700 p-3">
              <p className="text-xs text-slate-400 mb-1">Preview do corpo:</p>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{selectedTemplate.body_text}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Metric bar ────────────────────────────────────────────────────

const MetricBar: React.FC<{ label: string; value: number; color: string; max?: number }> = ({
  label, value, color, max = 100
}) => (
  <div>
    <div className="flex justify-between text-xs text-slate-400 mb-0.5">
      <span>{label}</span>
      <span className="font-medium text-slate-200">{value}%</span>
    </div>
    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(value, max)}%` }}
      />
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────────

interface Props {
  campaignId: string;
  campaignName: string;
}

const CampaignVariations: React.FC<Props> = ({ campaignId, campaignName }) => {
  const { data: variations = [], isLoading } = useCampaignVariations(campaignId);
  const deleteVar = useDeleteVariation();
  const selectWinner = useSelectWinner();
  const clearWinner = useClearWinner();
  const [modalTarget, setModalTarget] = useState<CampaignVariation | null | 'new'>(null);

  const usedLabels = variations.map(v => v.label);
  const hasWinner = variations.some(v => v.is_winner);
  const totalWeight = variations.reduce((s, v) => s + v.weight, 0);
  const weightOk = variations.length === 0 || Math.abs(totalWeight - 100) <= 5;

  const winner = variations.find(v => v.is_winner);
  const bestByReply = variations.length >= 2
    ? [...variations].sort((a, b) => replyRate(b) - replyRate(a))[0]
    : null;

  if (isLoading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-cyan-400" />
            Teste A/B de Templates
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Distribua envios entre variações e acompanhe qual converte melhor.
          </p>
        </div>
        {variations.length < 4 && (
          <Button size="sm" onClick={() => setModalTarget('new')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova variação
          </Button>
        )}
      </div>

      {/* Weight warning */}
      {variations.length > 0 && !weightOk && (
        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          Os pesos somam {totalWeight}% — ajuste para que totalizem 100%.
        </div>
      )}

      {/* Winner active banner */}
      {hasWinner && winner && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
            <Trophy className="w-4 h-4" />
            Vencedor: <span className="text-white">{winner.name || `Variação ${winner.label}`}</span>
            <span className="text-xs text-amber-400/70">— apenas esta variação está sendo usada</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white gap-1.5"
            onClick={() => clearWinner.mutate(campaignId)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retomar A/B
          </Button>
        </div>
      )}

      {/* Empty state */}
      {variations.length === 0 && (
        <div className="text-center py-12 border border-dashed border-slate-700 rounded-xl">
          <FlaskConical className="w-10 h-10 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400 text-sm">Sem variações configuradas.</p>
          <p className="text-slate-500 text-xs mt-1 mb-4">Crie variações A/B para testar diferentes templates e ver qual tem melhor desempenho.</p>
          <Button size="sm" variant="outline" onClick={() => setModalTarget('new')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Criar variação A
          </Button>
        </div>
      )}

      {/* Variation cards */}
      {variations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {variations.map((v, idx) => {
            const isLead = bestByReply && bestByReply.id === v.id && v.total_sent >= 10;
            return (
              <div
                key={v.id}
                className={`rounded-xl border p-4 space-y-3 transition-all ${
                  v.is_winner
                    ? 'border-amber-500/40 bg-amber-500/5'
                    : !v.is_active
                    ? 'border-slate-800 opacity-50'
                    : 'border-slate-700 bg-slate-900/40'
                }`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm ${METRIC_COLORS[idx] || 'bg-slate-700'}`}>
                      {v.label}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-white">{v.name || `Variação ${v.label}`}</span>
                        {v.is_winner && <Trophy className="w-3.5 h-3.5 text-amber-400" />}
                        {isLead && !v.is_winner && (
                          <Badge className="text-[10px] bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                            <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                            Em alta
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate max-w-[140px]">
                        {v.meta_template?.display_name || v.meta_template?.name || 'Sem template'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-slate-400">{v.weight}%</span>
                    <button
                      onClick={() => setModalTarget(v)}
                      className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    {!v.is_winner && (
                      <button
                        onClick={() => {
                          if (confirm(`Excluir variação ${v.label}?`)) {
                            deleteVar.mutate({ id: v.id, campaignId });
                          }
                        }}
                        className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Enviados', value: v.total_sent },
                    { label: 'Entregues', value: v.total_delivered },
                    { label: 'Respostas', value: v.total_replied },
                  ].map(s => (
                    <div key={s.label} className="bg-slate-800/60 rounded-lg py-1.5">
                      <p className="text-base font-bold text-white">{s.value}</p>
                      <p className="text-[10px] text-slate-500">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Metric bars */}
                <div className="space-y-2">
                  <MetricBar label="Entrega" value={deliveryRate(v)} color={METRIC_COLORS[idx] || 'bg-slate-600'} />
                  <MetricBar label="Leitura" value={readRate(v)} color={METRIC_COLORS[idx] || 'bg-slate-600'} />
                  <MetricBar label="Resposta" value={replyRate(v)} color={METRIC_COLORS[idx] || 'bg-slate-600'} />
                </div>

                {/* Definir vencedor */}
                {!v.is_winner && v.total_sent >= 50 && !hasWinner && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                    onClick={() => {
                      if (confirm(`Definir variação ${v.label} como vencedora? As outras variações serão pausadas.`)) {
                        selectWinner.mutate({ variationId: v.id, campaignId });
                      }
                    }}
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    Definir vencedora
                  </Button>
                )}
                {v.total_sent < 50 && !v.is_winner && (
                  <p className="text-[11px] text-center text-slate-600">
                    Mínimo 50 envios para definir vencedor ({v.total_sent}/50)
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Comparison summary (only when all have data) */}
      {variations.length >= 2 && variations.every(v => v.total_sent >= 10) && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <p className="text-xs text-slate-400 font-medium mb-3">Comparativo de resposta (Taxa de resposta %)</p>
          <div className="space-y-2">
            {[...variations]
              .sort((a, b) => replyRate(b) - replyRate(a))
              .map((v, idx) => (
                <div key={v.id} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-300 w-4">{v.label}</span>
                  <div className="flex-1 h-5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${idx === 0 ? 'bg-emerald-500' : 'bg-slate-600'} transition-all duration-700`}
                      style={{ width: `${replyRate(v)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-slate-200 w-8 text-right">{replyRate(v)}%</span>
                  {idx === 0 && <Trophy className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modalTarget && (
        <VariationModal
          campaignId={campaignId}
          existing={modalTarget === 'new' ? null : modalTarget}
          usedLabels={usedLabels.filter(l => l !== (modalTarget !== 'new' ? modalTarget.label : ''))}
          onClose={() => setModalTarget(null)}
        />
      )}
    </div>
  );
};

export default CampaignVariations;
