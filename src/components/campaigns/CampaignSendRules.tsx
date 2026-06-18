import React, { useEffect, useState } from 'react';
import { Shield, Clock, Zap, FlaskConical, Loader2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  CampaignSendRules as Rules,
  DEFAULT_SEND_RULES,
  useCampaignSendRules,
  useUpsertSendRules,
} from '@/hooks/useCampaignVariations';

interface Props {
  campaignId: string;
}

const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon, title, children,
}) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
    <div className="flex items-center gap-2">
      <div className="text-cyan-400">{icon}</div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
    </div>
    {children}
  </div>
);

const RangeField: React.FC<{
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, hint, value, min, max, step = 1, unit = '', onChange }) => (
  <div>
    <div className="flex justify-between items-center mb-1">
      <Label className="text-xs text-slate-300">{label}</Label>
      <span className="text-xs font-semibold text-white">{value}{unit}</span>
    </div>
    {hint && <p className="text-[11px] text-slate-500 mb-1">{hint}</p>}
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full accent-cyan-500"
    />
    <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
      <span>{min}{unit}</span>
      <span>{max}{unit}</span>
    </div>
  </div>
);

const NumberInput: React.FC<{
  label: string;
  hint?: string;
  value: number;
  min?: number;
  max?: number;
  unit?: string;
  onChange: (v: number) => void;
}> = ({ label, hint, value, min = 1, max, unit = '', onChange }) => (
  <div>
    <Label className="text-xs text-slate-300 mb-1 block">{label}</Label>
    {hint && <p className="text-[11px] text-slate-500 mb-1">{hint}</p>}
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white text-right"
      />
      {unit && <span className="text-xs text-slate-400">{unit}</span>}
    </div>
  </div>
);

const CampaignSendRules: React.FC<Props> = ({ campaignId }) => {
  const { data: saved, isLoading } = useCampaignSendRules(campaignId);
  const upsert = useUpsertSendRules();
  const [form, setForm] = useState<Rules>({ campaign_id: campaignId, ...DEFAULT_SEND_RULES });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (saved) {
      setForm({ ...DEFAULT_SEND_RULES, ...saved, campaign_id: campaignId });
    }
  }, [saved, campaignId]);

  const set = <K extends keyof Rules>(k: K, v: Rules[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const handleSave = async () => {
    await upsert.mutateAsync(form);
    setDirty(false);
  };

  if (isLoading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Regras de Envio
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure limites, intervalos e proteção automática contra bloqueios da Meta.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || upsert.isPending}
        >
          {upsert.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Salvar regras
        </Button>
      </div>

      {/* Meta-only notice */}
      <div className="flex items-center gap-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2.5 text-xs text-blue-300">
        <Info className="w-3.5 h-3.5 flex-shrink-0" />
        Campanhas usam exclusivamente a <strong className="text-blue-200 ml-1">API Oficial Meta</strong> — apenas templates aprovados são enviados.
      </div>

      {/* Rate limits */}
      <Section icon={<Zap className="w-4 h-4" />} title="Limites de Velocidade">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RangeField
            label="Máximo por hora"
            hint="Meta recomenda ≤ 250 para evitar flags"
            value={form.max_per_hour}
            min={10}
            max={500}
            step={10}
            unit=" msgs"
            onChange={v => set('max_per_hour', v)}
          />
          <RangeField
            label="Máximo por dia"
            value={form.max_per_day}
            min={50}
            max={5000}
            step={50}
            unit=" msgs"
            onChange={v => set('max_per_day', v)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RangeField
            label="Intervalo mínimo entre envios"
            hint="Evita pico de requisições"
            value={form.min_interval_seconds}
            min={1}
            max={60}
            unit="s"
            onChange={v => set('min_interval_seconds', v)}
          />
          <RangeField
            label="Intervalo máximo entre envios"
            hint="Randomização reduz padrões detectáveis"
            value={form.max_interval_seconds}
            min={form.min_interval_seconds}
            max={120}
            unit="s"
            onChange={v => set('max_interval_seconds', v)}
          />
        </div>
      </Section>

      {/* Block protection */}
      <Section icon={<Shield className="w-4 h-4" />} title="Proteção Contra Bloqueio">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-slate-200">Auto-pausar se taxa de erro subir</Label>
            <p className="text-xs text-slate-500 mt-0.5">
              Pausa a campanha automaticamente quando o percentual de erros excede o limite configurado.
            </p>
          </div>
          <Switch
            checked={form.auto_pause_on_errors}
            onCheckedChange={v => set('auto_pause_on_errors', v)}
          />
        </div>

        {form.auto_pause_on_errors && (
          <div className="pl-1 space-y-4 pt-1 border-l-2 border-slate-700 ml-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <RangeField
                label="Threshold de erro"
                hint="% de erros que dispara a pausa"
                value={form.error_rate_threshold}
                min={5}
                max={50}
                step={5}
                unit="%"
                onChange={v => set('error_rate_threshold', v)}
              />
              <NumberInput
                label="Janela de verificação"
                hint="Quantidade de envios recentes analisados"
                value={form.error_window_sends}
                min={10}
                max={200}
                unit="envios"
                onChange={v => set('error_window_sends', v)}
              />
              <NumberInput
                label="Duração da pausa"
                value={form.pause_duration_minutes}
                min={15}
                max={1440}
                unit="minutos"
                onChange={v => set('pause_duration_minutes', v)}
              />
            </div>
            <div className="bg-slate-800/50 rounded-lg px-3 py-2 text-xs text-slate-400">
              Exemplo: se {form.error_window_sends} envios recentes tiverem {form.error_rate_threshold}%+ de erros,
              a campanha pausa por {form.pause_duration_minutes >= 60
                ? `${Math.round(form.pause_duration_minutes / 60)}h`
                : `${form.pause_duration_minutes}min`}.
            </div>
          </div>
        )}
      </Section>

      {/* Business hours */}
      <Section icon={<Clock className="w-4 h-4" />} title="Horário de Envio">
        <p className="text-xs text-slate-500">
          Os horários de envio são herdados das configurações da campanha (campo "Horário Comercial").
          Os limites acima se aplicam dentro do horário permitido.
        </p>
        <div className="bg-slate-800/50 rounded-lg px-3 py-2.5 text-xs text-slate-300 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          Para alterar horários e dias úteis, edite as configurações da campanha na aba principal.
        </div>
      </Section>

      {/* A/B auto-winner */}
      <Section icon={<FlaskConical className="w-4 h-4" />} title="A/B — Seleção Automática de Vencedor">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm text-slate-200">Selecionar vencedor automaticamente</Label>
            <p className="text-xs text-slate-500 mt-0.5">
              Após atingir o mínimo de envios por variação, pausa as perdedoras e continua só com a melhor.
            </p>
          </div>
          <Switch
            checked={form.ab_auto_winner}
            onCheckedChange={v => set('ab_auto_winner', v)}
          />
        </div>

        {form.ab_auto_winner && (
          <div className="pl-1 space-y-4 pt-1 border-l-2 border-slate-700 ml-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <NumberInput
                label="Mínimo de envios por variação"
                hint="Precisa desta quantidade antes de comparar"
                value={form.ab_winner_min_sends}
                min={30}
                max={1000}
                unit="envios"
                onChange={v => set('ab_winner_min_sends', v)}
              />
              <div>
                <Label className="text-xs text-slate-300 mb-1.5 block">Métrica de comparação</Label>
                <div className="flex gap-2">
                  {[
                    { value: 'reply_rate', label: 'Resposta' },
                    { value: 'read_rate', label: 'Leitura' },
                    { value: 'delivery_rate', label: 'Entrega' },
                  ].map(m => (
                    <button
                      key={m.value}
                      onClick={() => set('ab_winner_metric', m.value as Rules['ab_winner_metric'])}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        form.ab_winner_metric === m.value
                          ? 'bg-cyan-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
};

export default CampaignSendRules;
