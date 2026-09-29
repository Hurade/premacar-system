import React from 'react';
import { Shield, Calendar, Plus, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApprovedMetaTemplates } from '@/hooks/useMetaTemplates';
import type { CampaignFormData } from '@/pages/CreateCampaign';

interface Step2bProps {
  data: CampaignFormData;
  onChange: (data: CampaignFormData) => void;
}

const weekDays = [
  { id: 0, label: 'Dom' },
  { id: 1, label: 'Seg' },
  { id: 2, label: 'Ter' },
  { id: 3, label: 'Qua' },
  { id: 4, label: 'Qui' },
  { id: 5, label: 'Sex' },
  { id: 6, label: 'Sáb' },
];

export function Step2bSendRules({ data, onChange }: Step2bProps) {
  const { data: metaTemplates = [] } = useApprovedMetaTemplates();
  const pacing = data.pacing;

  const updatePacing = (patch: Partial<CampaignFormData['pacing']>) => {
    onChange({ ...data, pacing: { ...pacing, ...patch } });
  };

  const addVariation = () => {
    const nextLabel = String.fromCharCode(65 + data.variations.length); // A, B, C...
    onChange({
      ...data,
      variations: [
        ...data.variations,
        { label: nextLabel, name: '', weight: 50, meta_template_id: null },
      ],
    });
  };

  const updateVariation = (index: number, patch: Partial<CampaignFormData['variations'][number]>) => {
    const next = [...data.variations];
    next[index] = { ...next[index], ...patch };
    onChange({ ...data, variations: next });
  };

  const removeVariation = (index: number) => {
    onChange({ ...data, variations: data.variations.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">🛡️ Envio &amp; Segurança</h2>
      <p className="text-sm text-muted-foreground -mt-4">
        Só relevante pros dias de WhatsApp desta campanha — protege contra bloqueio da Meta/Evolution
        quando o dia atinge muitos contatos de uma vez (ex: uma campanha de reativação em massa).
      </p>

      {/* Anti-ban toggle */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2 cursor-help">
            <Shield className="w-4 h-4" />
            Proteção Anti-Ban (paginação de envio)
          </Label>
          <Switch checked={pacing.anti_ban_enabled} onCheckedChange={(v) => updatePacing({ anti_ban_enabled: v })} />
        </div>

        {!pacing.anti_ban_enabled && (
          <p className="text-xs text-muted-foreground">
            Desligado: cada dia da campanha dispara pra todos os contatos due de uma vez, sem intervalo
            (ok pra poucos contatos por dia). Ligue para campanhas com muitos contatos no mesmo dia de WhatsApp.
          </p>
        )}

        {pacing.anti_ban_enabled && (
          <div className="space-y-5 pl-1">
            <div className="space-y-3">
              <Label>Limite Diário: {pacing.daily_limit} mensagens/dia</Label>
              <Slider
                value={[pacing.daily_limit]}
                onValueChange={([v]) => updatePacing({ daily_limit: v })}
                min={1}
                max={500}
                step={10}
              />
              <p className="text-xs text-muted-foreground">
                No máximo 1 envio de WhatsApp por execução do processador (a cada minuto), até este limite.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Horário Comercial
                </Label>
                <Switch
                  checked={pacing.business_hours_enabled}
                  onCheckedChange={(v) => updatePacing({ business_hours_enabled: v })}
                />
              </div>

              {pacing.business_hours_enabled && (
                <div className="space-y-4 pl-6 border-l-2 border-border">
                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Início</Label>
                      <Input
                        type="time"
                        value={pacing.business_hours_start}
                        onChange={(e) => updatePacing({ business_hours_start: e.target.value })}
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fim</Label>
                      <Input
                        type="time"
                        value={pacing.business_hours_end}
                        onChange={(e) => updatePacing({ business_hours_end: e.target.value })}
                        className="w-32"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {weekDays.map((day) => (
                      <div key={day.id} className="flex items-center gap-1">
                        <Checkbox
                          id={`day-${day.id}`}
                          checked={pacing.business_days.includes(day.id)}
                          onCheckedChange={(checked) => {
                            updatePacing({
                              business_days: checked
                                ? [...pacing.business_days, day.id].sort()
                                : pacing.business_days.filter((d) => d !== day.id),
                            });
                          }}
                        />
                        <label htmlFor={`day-${day.id}`} className="text-sm">{day.label}</label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Pausa automática por taxa de erro</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={pacing.send_rules.auto_pause_on_errors}
                  onCheckedChange={(v) => updatePacing({ send_rules: { ...pacing.send_rules, auto_pause_on_errors: v } })}
                />
                <span className="text-sm text-muted-foreground">
                  Pausa a campanha se {pacing.send_rules.error_rate_threshold}% dos últimos {pacing.send_rules.error_window_sends} envios falharem
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* A/B Variations */}
      <div className="bg-card/50 border border-border/50 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Label>🧪 Variações A/B (opcional)</Label>
          <Button size="sm" variant="outline" onClick={addVariation} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Nova variação
          </Button>
        </div>

        {data.variations.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sem variações: todos os contatos recebem a mensagem/template configurado no dia de WhatsApp
            (Etapa Fluxo). Adicione variações para testar templates diferentes e medir qual converte mais.
          </p>
        ) : (
          <div className="space-y-3">
            {data.variations.map((v, i) => (
              <div key={i} className="border border-border/50 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {v.label}
                  </span>
                  <Input
                    value={v.name}
                    onChange={(e) => updateVariation(i, { name: e.target.value })}
                    placeholder="Nome da variação (ex: Tom formal)"
                    className="flex-1"
                  />
                  <Button size="icon" variant="ghost" onClick={() => removeVariation(i)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Template Meta</Label>
                    <Select
                      value={v.meta_template_id || 'none'}
                      onValueChange={(val) => updateVariation(i, { meta_template_id: val === 'none' ? null : val })}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Usar o do dia (padrão)</SelectItem>
                        {metaTemplates.map((t: any) => (
                          <SelectItem key={t.id} value={t.id}>{t.display_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-32 space-y-1">
                    <Label className="text-xs">Peso: {v.weight}%</Label>
                    <Slider
                      value={[v.weight]}
                      onValueChange={([val]) => updateVariation(i, { weight: val })}
                      min={5}
                      max={100}
                      step={5}
                    />
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Switch
                checked={pacing.send_rules.ab_auto_winner}
                onCheckedChange={(v) => updatePacing({ send_rules: { ...pacing.send_rules, ab_auto_winner: v } })}
              />
              <span className="text-sm text-muted-foreground">
                Escolher vencedor automaticamente após {pacing.send_rules.ab_winner_min_sends} envios por variação
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
