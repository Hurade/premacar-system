import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Pencil, Check } from 'lucide-react';
import { useApprovedMetaTemplates } from '@/hooks/useMetaTemplates';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { CampaignFormData } from '@/pages/CreateCampaign';

interface Step2Props {
  data: CampaignFormData;
  onChange: (data: CampaignFormData) => void;
}

const CHANNEL_CONFIG: Record<string, { icon: string; label: string }> = {
  whatsapp: { icon: '💬', label: 'WhatsApp' },
  call: { icon: '📞', label: 'Ligação' },
  email: { icon: '📧', label: 'Email' },
  sms: { icon: '📱', label: 'SMS' },
  finalize: { icon: '🏁', label: 'Finalizar' },
};

export function Step2FlowConfig({ data, onChange }: Step2Props) {
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<any>(null);

  // Fetch approved Meta templates
  const { data: metaTemplates = [], isLoading: loadingMeta } = useApprovedMetaTemplates();

  // Fetch email templates
  const { data: emailTemplates = [], isLoading: loadingEmail } = useQuery({
    queryKey: ['email-templates-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const flowConfig = data.flow_config;
  const dayKeys = Object.keys(flowConfig).sort();

  const addDay = () => {
    const nextNum = dayKeys.length + 1;
    const newKey = `day${nextNum}`;
    onChange({
      ...data,
      flow_config: {
        ...flowConfig,
        [newKey]: {
          type: 'whatsapp',
          enabled: true,
          timing: { type: 'delay', hours: 24 },
          config: { template: '', message: '' },
          successConditions: [{ condition: 'replied', tag: `Dia${nextNum}_Respondeu`, action: 'mark_success' }],
          failConditions: [{ condition: 'no_reply_24h', tag: `Dia${nextNum}_NaoRespondeu`, action: 'advance_day' }],
        },
      },
    });
  };

  const removeDay = (key: string) => {
    const updated = { ...flowConfig };
    delete updated[key];
    const reNumbered: Record<string, any> = {};
    Object.values(updated).forEach((v, i) => {
      reNumbered[`day${i + 1}`] = v;
    });
    onChange({ ...data, flow_config: reNumbered });
  };

  const toggleDay = (key: string, enabled: boolean) => {
    onChange({
      ...data,
      flow_config: { ...flowConfig, [key]: { ...flowConfig[key], enabled } },
    });
  };

  const openEdit = (key: string) => {
    setEditingDay(key);
    setEditConfig({ ...flowConfig[key] });
  };

  const saveEdit = () => {
    if (editingDay && editConfig) {
      onChange({
        ...data,
        flow_config: { ...flowConfig, [editingDay]: editConfig },
      });
    }
    setEditingDay(null);
    setEditConfig(null);
  };

  // Get display info for a day config
  const getDayDescription = (cfg: any) => {
    if (cfg.type === 'whatsapp' && cfg.config?.meta_template_id) {
      const t = metaTemplates.find((t: any) => t.id === cfg.config.meta_template_id);
      return t ? `Template: ${t.display_name}` : 'Template selecionado';
    }
    if (cfg.type === 'email' && cfg.config?.email_template_id) {
      const t = emailTemplates.find((t: any) => t.id === cfg.config.email_template_id);
      return t ? `Template: ${t.name}` : 'Template selecionado';
    }
    if (cfg.config?.message) {
      return cfg.config.message.substring(0, 60) + (cfg.config.message.length > 60 ? '...' : '');
    }
    return 'Clique em Editar para configurar';
  };

  // Selected meta template for preview in modal
  const selectedMetaTemplate = editConfig?.type === 'whatsapp' && editConfig?.config?.meta_template_id
    ? metaTemplates.find((t: any) => t.id === editConfig.config.meta_template_id)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">⚙️ Configurar Fluxo de Ações</h2>
        <p className="text-sm text-muted-foreground mt-1">Configure as ações executadas em cada dia da campanha</p>
      </div>

      {/* Day cards */}
      <div className="space-y-3">
        {dayKeys.map((key) => {
          const dayNum = key.replace('day', '');
          const cfg = flowConfig[key];
          const channel = CHANNEL_CONFIG[cfg.type] || CHANNEL_CONFIG.whatsapp;

          return (
            <div
              key={key}
              className={`border rounded-xl p-4 transition-colors ${
                cfg.enabled ? 'border-border/50 bg-card/30' : 'border-border/30 bg-card/10 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{channel.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">DIA {dayNum}</span>
                      <span className="text-sm text-muted-foreground">— {channel.label}</span>
                      {cfg.enabled && <Badge variant="outline" className="text-[10px]">Ativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {cfg.timing?.type === 'immediate'
                        ? 'Envio imediato'
                        : cfg.timing?.type === 'delay'
                        ? `${cfg.timing.hours}h após dia anterior`
                        : 'Automático'}
                      {' · '}
                      {getDayDescription(cfg)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch checked={cfg.enabled} onCheckedChange={(v) => toggleDay(key, v)} />
                  <Button variant="ghost" size="sm" onClick={() => openEdit(key)} className="gap-1.5">
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </Button>
                  {dayKeys.length > 1 && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => removeDay(key)}>
                      ✕
                    </Button>
                  )}
                </div>
              </div>

              {cfg.enabled && cfg.successConditions?.length > 0 && (
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {cfg.successConditions.map((c: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">✅ {c.tag}</Badge>
                  ))}
                  {cfg.failConditions?.map((c: any, i: number) => (
                    <Badge key={`f${i}`} variant="outline" className="text-[10px]">❌ {c.tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {dayKeys.length < (data.duration || 7) && (
        <Button variant="outline" onClick={addDay} className="w-full border-dashed">
          + Adicionar Dia
        </Button>
      )}

      {/* Edit Modal */}
      <Dialog open={!!editingDay} onOpenChange={(open) => !open && setEditingDay(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Dia {editingDay?.replace('day', '')}</DialogTitle>
          </DialogHeader>

          {editConfig && (
            <div className="space-y-4">
              {/* Channel type */}
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select
                  value={editConfig.type}
                  onValueChange={(v) => setEditConfig({
                    ...editConfig,
                    type: v,
                    config: { message: '' }, // reset config on channel change
                  })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">💬 WhatsApp</SelectItem>
                    <SelectItem value="call">📞 Ligação</SelectItem>
                    <SelectItem value="email">📧 Email</SelectItem>
                    <SelectItem value="sms">📱 SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Timing */}
              <div className="space-y-2">
                <Label>Intervalo</Label>
                <Select
                  value={editConfig.timing?.type || 'delay'}
                  onValueChange={(v) => setEditConfig({ ...editConfig, timing: { ...editConfig.timing, type: v } })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Envio imediato</SelectItem>
                    <SelectItem value="delay">Atraso (horas)</SelectItem>
                  </SelectContent>
                </Select>
                {editConfig.timing?.type === 'delay' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      type="number"
                      value={editConfig.timing?.hours || 24}
                      onChange={(e) => setEditConfig({ ...editConfig, timing: { ...editConfig.timing, hours: parseInt(e.target.value) || 24 } })}
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">horas após dia anterior</span>
                  </div>
                )}
              </div>

              {/* === WHATSAPP: Meta Template Selector === */}
              {editConfig.type === 'whatsapp' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Template WhatsApp (Meta)</Label>
                    <Select
                      value={editConfig.config?.meta_template_id || 'custom'}
                      onValueChange={(v) => {
                        if (v === 'custom') {
                          setEditConfig({
                            ...editConfig,
                            config: { ...editConfig.config, meta_template_id: null },
                          });
                        } else {
                          const template = metaTemplates.find((t: any) => t.id === v);
                          setEditConfig({
                            ...editConfig,
                            config: {
                              ...editConfig.config,
                              meta_template_id: v,
                              message: template?.body_text || editConfig.config?.message || '',
                            },
                          });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecionar template..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">✏️ Mensagem Personalizada</SelectItem>
                        {loadingMeta ? (
                          <SelectItem value="_loading" disabled>Carregando...</SelectItem>
                        ) : metaTemplates.length === 0 ? (
                          <SelectItem value="_empty" disabled>Nenhum template aprovado</SelectItem>
                        ) : (
                          metaTemplates.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.display_name} ({t.language_code})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Templates aprovados da Meta (mesmos usados em Disparos)
                    </p>
                  </div>

                  {/* Preview of selected Meta template */}
                  {selectedMetaTemplate && (
                    <div className="bg-secondary/30 border border-border/50 rounded-lg p-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Preview do Template</p>
                      {selectedMetaTemplate.header_text && (
                        <p className="text-sm font-semibold text-foreground">{selectedMetaTemplate.header_text}</p>
                      )}
                      <p className="text-sm text-foreground whitespace-pre-wrap">{selectedMetaTemplate.body_text}</p>
                      {selectedMetaTemplate.footer_text && (
                        <p className="text-xs text-muted-foreground italic">{selectedMetaTemplate.footer_text}</p>
                      )}
                      {selectedMetaTemplate.parameters_count > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          📌 {selectedMetaTemplate.parameters_count} parâmetro(s) dinâmico(s)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Custom message if no template selected */}
                  {!editConfig.config?.meta_template_id && (
                    <div className="space-y-2">
                      <Label>Mensagem Personalizada</Label>
                      <Textarea
                        value={editConfig.config?.message || ''}
                        onChange={(e) => setEditConfig({ ...editConfig, config: { ...editConfig.config, message: e.target.value } })}
                        placeholder="Use {{nome}}, {{empresa}} para variáveis..."
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">Variáveis: {'{{nome}}'}, {'{{empresa}}'}, {'{{telefone}}'}</p>
                    </div>
                  )}
                </div>
              )}

              {/* === EMAIL: Template + Custom Editor === */}
              {editConfig.type === 'email' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Template de Email</Label>
                    <Select
                      value={editConfig.config?.email_template_id || 'custom'}
                      onValueChange={(v) => {
                        if (v === 'custom') {
                          setEditConfig({
                            ...editConfig,
                            config: { ...editConfig.config, email_template_id: null },
                          });
                        } else {
                          const template = emailTemplates.find((t: any) => t.id === v);
                          setEditConfig({
                            ...editConfig,
                            config: {
                              ...editConfig.config,
                              email_template_id: v,
                              subject: template?.subject || '',
                              message: template?.text_body || template?.html_body || '',
                            },
                          });
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecionar template..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">✏️ Mensagem Personalizada</SelectItem>
                        {loadingEmail ? (
                          <SelectItem value="_loading" disabled>Carregando...</SelectItem>
                        ) : emailTemplates.length === 0 ? (
                          <SelectItem value="_empty" disabled>Nenhum template encontrado</SelectItem>
                        ) : (
                          emailTemplates.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>
                              📧 {t.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Assunto *</Label>
                    <Input
                      value={editConfig.config?.subject || ''}
                      onChange={(e) => setEditConfig({
                        ...editConfig,
                        config: { ...editConfig.config, subject: e.target.value },
                      })}
                      placeholder="Ex: Acompanhamento da sua solicitação"
                    />
                    <p className="text-xs text-muted-foreground">Variáveis: {'{{nome}}'}, {'{{empresa}}'}</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem do Email *</Label>
                    <Textarea
                      value={editConfig.config?.message || ''}
                      onChange={(e) => setEditConfig({
                        ...editConfig,
                        config: { ...editConfig.config, message: e.target.value },
                      })}
                      placeholder="Digite a mensagem do email aqui... Aceita HTML."
                      rows={6}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Aceita HTML. Variáveis: {'{{nome}}'}, {'{{empresa}}'}, {'{{telefone}}'}
                    </p>
                  </div>
                </div>
              )}

              {/* === CALL config === */}
              {editConfig.type === 'call' && (
                <div className="space-y-2">
                  <Label>Tipo de Voz</Label>
                  <Select
                    value={editConfig.config?.voiceType || 'ai'}
                    onValueChange={(v) => setEditConfig({
                      ...editConfig,
                      config: { ...editConfig.config, voiceType: v },
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ai">🎙️ Voz AI (ElevenLabs)</SelectItem>
                      <SelectItem value="tts">🔊 TTS Padrão (Twilio)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    ℹ️ O script usará automaticamente o prompt configurado no sistema
                  </p>
                </div>
              )}

              {/* === SMS: simple message === */}
              {editConfig.type === 'sms' && (
                <div className="space-y-2">
                  <Label>Mensagem SMS</Label>
                  <Textarea
                    value={editConfig.config?.message || ''}
                    onChange={(e) => setEditConfig({ ...editConfig, config: { ...editConfig.config, message: e.target.value } })}
                    placeholder="Use {{nome}} para variáveis..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">Máximo 160 caracteres recomendado</p>
                </div>
              )}

              {/* Success tag */}
              <div className="space-y-2">
                <Label>Tag de Sucesso</Label>
                <Input
                  value={editConfig.successConditions?.[0]?.tag || ''}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      successConditions: [{ ...editConfig.successConditions?.[0], tag: e.target.value, condition: 'replied', action: 'mark_success' }],
                    })
                  }
                />
              </div>

              {/* Fail tag */}
              <div className="space-y-2">
                <Label>Tag de Falha</Label>
                <Input
                  value={editConfig.failConditions?.[0]?.tag || ''}
                  onChange={(e) =>
                    setEditConfig({
                      ...editConfig,
                      failConditions: [{ ...editConfig.failConditions?.[0], tag: e.target.value, condition: 'no_reply_24h', action: 'advance_day' }],
                    })
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDay(null)}>Cancelar</Button>
            <Button onClick={saveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
