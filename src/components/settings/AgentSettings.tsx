import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Bot, Loader2, Calendar, Building2, Info, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import SpecializedAgentsSection from './SpecializedAgentsSection';
import { useAuth } from '@/hooks/useAuth';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AgentSettings {
  id?: string;
  is_active: boolean;
  auto_response_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  company_name: string | null;
  sdr_name: string | null;
  ai_scheduling_enabled: boolean;
  message_grouping_enabled: boolean;
  message_grouping_delay: number;
  scheduling_notify_phone: string | null;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export interface AgentSettingsRef {
  save: () => Promise<void>;
  cancel: () => void;
  isSaving: boolean;
}

const AgentSettings = forwardRef<AgentSettingsRef, {}>((props, ref) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingNotif, setTestingNotif] = useState(false);
  const [settings, setSettings] = useState<AgentSettings>({
    is_active: true,
    auto_response_enabled: true,
    business_hours_start: '09:00',
    business_hours_end: '18:00',
    business_days: [1, 2, 3, 4, 5],
    company_name: null,
    sdr_name: null,
    ai_scheduling_enabled: true,
    message_grouping_enabled: true,
    message_grouping_delay: 20000,
    scheduling_notify_phone: null,
  });

  useImperativeHandle(ref, () => ({
    save: handleSave,
    cancel: loadSettings,
    isSaving: saving
  }));

  useEffect(() => {
    if (user?.id) {
      loadSettings();
    }
  }, [user?.id]);

  const loadSettings = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      // Fetch global nina_settings (no user_id filter - single tenant)
      const { data, error } = await supabase
        .from('nina_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      // Se não existe registro, admin precisa configurar via onboarding
      if (!data) {
        console.log('[AgentSettings] No global settings found');
        setLoading(false);
        return;
      }

      // Load settings from global data
      setSettings({
        id: data.id,
        is_active: data.is_active,
        auto_response_enabled: data.auto_response_enabled,
        business_hours_start: data.business_hours_start,
        business_hours_end: data.business_hours_end,
        business_days: data.business_days,
        company_name: data.company_name,
        sdr_name: data.sdr_name,
        ai_scheduling_enabled: data.ai_scheduling_enabled ?? true,
        message_grouping_enabled: data.message_grouping_enabled ?? true,
        message_grouping_delay: data.message_grouping_delay ?? 20000,
        scheduling_notify_phone: data.scheduling_notify_phone ?? null,
      });
    } catch (error) {
      console.error('[AgentSettings] Error loading settings:', error);
      toast.error('Erro ao carregar configurações do agente');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update global settings (no user_id filter needed - RLS handles admin check)
      const { error } = await supabase
        .from('nina_settings')
        .update({
          is_active: settings.is_active,
          auto_response_enabled: settings.auto_response_enabled,
          business_hours_start: settings.business_hours_start,
          business_hours_end: settings.business_hours_end,
          business_days: settings.business_days,
          company_name: settings.company_name,
          sdr_name: settings.sdr_name,
          ai_scheduling_enabled: settings.ai_scheduling_enabled,
          message_grouping_enabled: settings.message_grouping_enabled,
          message_grouping_delay: settings.message_grouping_delay,
          scheduling_notify_phone: settings.scheduling_notify_phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id!);

      if (error) throw error;

      toast.success('Configurações do agente salvas com sucesso!');
    } catch (error) {
      console.error('Error saving agent settings:', error);
      toast.error('Erro ao salvar configurações do agente');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!settings.scheduling_notify_phone?.trim()) {
      toast.error('Preencha o número antes de testar');
      return;
    }
    setTestingNotif(true);
    try {
      const cleanPhone = settings.scheduling_notify_phone.replace(/\D/g, '');
      console.log('[AgentSettings] Sending test notification to:', cleanPhone);

      const { data, error } = await supabase.functions.invoke('test-whatsapp-message', {
        body: {
          phone_number: cleanPhone,
          message: '🔔 Teste de notificação PremaCar\n\nSe você recebeu essa mensagem, a notificação de novos leads está configurada corretamente!',
          api_type: 'evolution',
        },
      });

      console.log('[AgentSettings] Test response:', { data, error });

      if (error) {
        console.error('[AgentSettings] Function invocation error:', error);
        throw new Error(error.message || String(error));
      }

      if (data?.success) {
        toast.success('Mensagem de teste enviada!');
      } else {
        const detail = data?.error || data?.details?.message || 'Erro desconhecido';
        console.error('[AgentSettings] Evolution API returned failure:', detail, 'full response:', data);
        throw new Error(detail);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[AgentSettings] Test notification failed:', msg);
      toast.error('Falha ao enviar', { description: msg });
    } finally {
      setTestingNotif(false);
    }
  };

  const toggleBusinessDay = (day: number) => {
    setSettings(prev => ({
      ...prev,
      business_days: prev.business_days.includes(day)
        ? prev.business_days.filter(d => d !== day)
        : [...prev.business_days, day].sort()
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* 2-Column Grid: Company Info + Business Hours */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Company Info */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-white">Informações da Empresa</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Nome da Empresa <span className="text-amber-400 text-[10px]">(recomendado)</span>
                </label>
                <input
                  type="text"
                  value={settings.company_name || ''}
                  onChange={(e) => setSettings({ ...settings, company_name: e.target.value || null })}
                  placeholder="Nome da sua empresa"
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Nome do Agente <span className="text-amber-400 text-[10px]">(recomendado)</span>
                </label>
                <input
                  type="text"
                  value={settings.sdr_name || ''}
                  onChange={(e) => setSettings({ ...settings, sdr_name: e.target.value || null })}
                  placeholder="Nome do agente (ex: Ana, Sofia)"
                  className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-1.5 block">
                  Número para notificação de novos leads
                </label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={settings.scheduling_notify_phone || ''}
                    onChange={(e) => setSettings({ ...settings, scheduling_notify_phone: e.target.value || null })}
                    placeholder="Ex: 5548999999999 (com DDI e DDD, sem espaços)"
                    className="h-9 flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    disabled={testingNotif || !settings.scheduling_notify_phone?.trim()}
                    className="h-9 px-3 flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {testingNotif ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    Testar
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Recebe aviso via WhatsApp quando um lead aceita a demonstração.
                </p>
              </div>
            </div>
          </div>

          {/* Business Hours */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Calendar className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-white">Horário de Atendimento</h3>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Início</label>
                  <input
                    type="time"
                    value={settings.business_hours_start}
                    onChange={(e) => setSettings({ ...settings, business_hours_start: e.target.value })}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-400 mb-1.5 block">Fim</label>
                  <input
                    type="time"
                    value={settings.business_hours_end}
                    onChange={(e) => setSettings({ ...settings, business_hours_end: e.target.value })}
                    className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-400 mb-2 block">Dias da Semana</label>
                <div className="flex gap-2">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      onClick={() => toggleBusinessDay(day.value)}
                      className={`flex-1 h-9 text-xs font-medium rounded-lg transition-all ${
                        settings.business_days.includes(day.value)
                          ? 'bg-indigo-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Comportamento Geral */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bot className="w-5 h-5 text-violet-400" />
            <h3 className="font-semibold text-white">Comportamento Geral</h3>
            <p className="text-xs text-slate-500">
              Interruptores globais — prompt, modelo e comportamento de cada agente ficam na lista "Agentes de IA" abaixo.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-slate-300 cursor-help flex items-center gap-1.5">
                    IA Ativa
                    <Info className="w-3 h-3 text-slate-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Liga ou desliga a IA completamente, para todos os agentes. Quando desativado, nenhuma resposta automática será enviada.</p>
                </TooltipContent>
              </Tooltip>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.is_active}
                  onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-slate-300 cursor-help flex items-center gap-1.5">
                    Resposta Automática
                    <Info className="w-3 h-3 text-slate-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Quando ativo, o agente responde automaticamente sem necessidade de aprovação humana.</p>
                </TooltipContent>
              </Tooltip>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.auto_response_enabled}
                  onChange={(e) => setSettings({ ...settings, auto_response_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-950/50 border border-slate-800">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-slate-300 cursor-help flex items-center gap-1.5">
                    Agendamento via IA
                    <Info className="w-3 h-3 text-slate-500" />
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Permite que o agente crie, altere e cancele agendamentos automaticamente durante a conversa.</p>
                </TooltipContent>
              </Tooltip>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.ai_scheduling_enabled}
                  onChange={(e) => setSettings({ ...settings, ai_scheduling_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>
          </div>

          {/* Message Grouping Section */}
          <div className="mt-6 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-300">Agrupamento de Mensagens</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-3.5 h-3.5 text-slate-500 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-xs">
                      Quando ativo, aguarda um período antes de responder para agrupar mensagens seguidas do cliente em uma única resposta.
                      Evita respostas múltiplas quando o cliente envia mensagens "picotadas".
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.message_grouping_enabled}
                  onChange={(e) => setSettings({ ...settings, message_grouping_enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {settings.message_grouping_enabled && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-400">
                      Tempo de espera: <span className="text-cyan-400">{Math.round(settings.message_grouping_delay / 1000)}s</span>
                    </label>
                    <span className="text-[10px] text-slate-500">Recomendado: 15-30s</span>
                  </div>
                  <input
                    type="range"
                    min="5000"
                    max="60000"
                    step="1000"
                    value={settings.message_grouping_delay}
                    onChange={(e) => setSettings({ ...settings, message_grouping_delay: parseInt(e.target.value) })}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                    <span>5s</span>
                    <span>30s</span>
                    <span>60s</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Aguarda este tempo após cada mensagem antes de processar. Se o cliente enviar outra mensagem durante o período,
                  o timer reinicia e todas as mensagens são combinadas em uma única resposta.
                </p>
              </div>
            )}
          </div>
        </div>

        <SpecializedAgentsSection />
      </div>
    </TooltipProvider>
  );
});

AgentSettings.displayName = 'AgentSettings';

export default AgentSettings;
