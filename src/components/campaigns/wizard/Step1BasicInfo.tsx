import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { CampaignFormData } from '@/pages/CreateCampaign';

interface Step1Props {
  data: CampaignFormData;
  onChange: (data: CampaignFormData) => void;
}

export function Step1BasicInfo({ data, onChange }: Step1Props) {
  const [connections, setConnections] = useState<Array<{ id: string; name: string; api_type: string }>>([]);

  useEffect(() => {
    supabase
      .from('whatsapp_connections')
      .select('id, name, api_type')
      .eq('is_active', true)
      .order('name')
      .then(({ data: rows }) => setConnections(rows || []));
  }, []);

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = (e.target as HTMLInputElement).value.trim();
      if (value && !data.tags.includes(value)) {
        onChange({ ...data, tags: [...data.tags, value] });
        (e.target as HTMLInputElement).value = '';
      }
    }
  };

  const removeTag = (index: number) => {
    onChange({ ...data, tags: data.tags.filter((_, i) => i !== index) });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-foreground">📝 Informações Básicas</h2>

      {/* Nome */}
      <div className="space-y-2">
        <Label>Nome da Campanha *</Label>
        <Input
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="Ex: Prospecção Q1 2026"
        />
      </div>

      {/* Descrição */}
      <div className="space-y-2">
        <Label>Descrição (opcional)</Label>
        <Textarea
          value={data.description}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Descreva o objetivo desta campanha..."
          rows={3}
        />
      </div>

      {/* Objetivo */}
      <div className="space-y-3">
        <Label>Objetivo da Campanha *</Label>
        <RadioGroup
          value={data.objective}
          onValueChange={(value) => onChange({ ...data, objective: value })}
          className="space-y-2"
        >
          {[
            { value: 'prospecting', label: '🎯 Prospecção (primeiro contato)' },
            { value: 'follow_up', label: '🔄 Follow-up (já teve contato)' },
            { value: 'reactivation', label: '🔙 Reativação (inativos)' },
            { value: 'nurture', label: '📚 Nutrição (educação/conteúdo)' },
          ].map((opt) => (
            <div key={opt.value} className="flex items-center space-x-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <RadioGroupItem value={opt.value} id={opt.value} />
              <Label htmlFor={opt.value} className="cursor-pointer flex-1">{opt.label}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Duração */}
      <div className="space-y-2">
        <Label>Duração Máxima *</Label>
        <Select
          value={String(data.duration)}
          onValueChange={(value) => onChange({ ...data, duration: parseInt(value) })}
        >
          <SelectTrigger className="bg-card/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 dias (recomendado)</SelectItem>
            <SelectItem value="4">4 dias</SelectItem>
            <SelectItem value="5">5 dias</SelectItem>
            <SelectItem value="6">6 dias</SelectItem>
            <SelectItem value="7">7 dias</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Recomendado: 3-5 dias para melhor conversão
        </p>
      </div>

      {/* Conexão WhatsApp */}
      <div className="space-y-2">
        <Label>Conexão WhatsApp</Label>
        <Select
          value={data.connection_id ?? '__default__'}
          onValueChange={(value) => onChange({ ...data, connection_id: value === '__default__' ? null : value })}
        >
          <SelectTrigger className="bg-card/50 border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Usar configuração padrão</SelectItem>
            {connections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.api_type === 'meta_official' ? '✅' : '🔧'} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Conexão usada nos dias de WhatsApp desta campanha. Deixe em "padrão" para manter o comportamento atual.
        </p>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags Automáticas</Label>
        <div className="flex gap-2 flex-wrap">
          {data.tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button onClick={() => removeTag(index)} className="ml-1 hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Input
          placeholder="Digite e pressione Enter para adicionar"
          onKeyDown={handleAddTag}
          className="mt-2"
        />
      </div>
    </div>
  );
}
