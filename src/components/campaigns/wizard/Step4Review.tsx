import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';
import type { CampaignFormData } from '@/pages/CreateCampaign';

interface Step4Props {
  data: CampaignFormData;
  onSubmit: () => void;
  loading: boolean;
}

const OBJECTIVE_LABELS: Record<string, string> = {
  prospecting: '🎯 Prospecção',
  follow_up: '🔄 Follow-up',
  reactivation: '🔙 Reativação',
  nurture: '📚 Nutrição',
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: '💬 WhatsApp',
  call: '📞 Ligação',
  email: '📧 Email',
  sms: '📱 SMS',
};

export function Step4Review({ data, onSubmit, loading }: Step4Props) {
  const [agreed, setAgreed] = useState(false);
  const flowDays = Object.entries(data.flow_config).filter(([_, v]) => v.enabled);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">✅ Revisão Final</h2>

      {/* Basic Info */}
      <div className="border border-border/50 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-foreground text-sm">📝 Informações Básicas</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Nome:</span>{' '}
            <span className="text-foreground">{data.name}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Objetivo:</span>{' '}
            <span className="text-foreground">{OBJECTIVE_LABELS[data.objective] || data.objective}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Duração:</span>{' '}
            <span className="text-foreground">{data.duration} dias</span>
          </div>
        </div>
        {data.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mt-2">
            {data.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Flow */}
      <div className="border border-border/50 rounded-xl p-4 space-y-2">
        <h3 className="font-semibold text-foreground text-sm">⚙️ Fluxo Configurado</h3>
        <div className="space-y-1.5">
          {flowDays.map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Dia {key.replace('day', '')}:</span>
              <span className="text-foreground">{CHANNEL_LABELS[cfg.type] || cfg.type}</span>
              {cfg.timing?.type === 'delay' && (
                <span className="text-xs text-muted-foreground">({cfg.timing.hours}h)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contacts */}
      <div className="border border-border/50 rounded-xl p-4">
        <h3 className="font-semibold text-foreground text-sm">👥 Contatos</h3>
        <p className="text-sm text-foreground mt-1">
          Total: <span className="font-bold text-primary">{data.contacts.length}</span> contatos selecionados
        </p>
      </div>

      {/* Agreement */}
      <label className="flex items-start gap-3 p-4 bg-secondary/30 rounded-xl cursor-pointer">
        <Checkbox
          checked={agreed}
          onCheckedChange={(v) => setAgreed(!!v)}
          className="mt-0.5"
        />
        <span className="text-sm text-muted-foreground">
          Ao ativar, a campanha começará a executar ações automaticamente conforme o fluxo configurado.
          Você pode pausar ou cancelar a qualquer momento.
        </span>
      </label>

      {/* Submit */}
      <Button
        onClick={onSubmit}
        disabled={!agreed || loading || data.contacts.length === 0}
        className="w-full gap-2 h-12 text-base"
        size="lg"
      >
        <Rocket className="w-5 h-5" />
        {loading ? 'Criando campanha...' : '🚀 Ativar Campanha'}
      </Button>
    </div>
  );
}
