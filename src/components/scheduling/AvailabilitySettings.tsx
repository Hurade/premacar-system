import React, { useState, useEffect } from 'react';
import { Clock, Calendar, Settings2, Save, Loader2, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/Button';
import { useCompanySettings } from '@/hooks/useCompanySettings';

interface AvailabilityConfig {
  scheduling_available_days: number[];
  scheduling_start_time: string;
  scheduling_end_time: string;
  scheduling_slot_duration: number;
  scheduling_buffer_between: number;
  google_calendar_url: string | null;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom', fullLabel: 'Domingo' },
  { value: 1, label: 'Seg', fullLabel: 'Segunda' },
  { value: 2, label: 'Ter', fullLabel: 'Terça' },
  { value: 3, label: 'Qua', fullLabel: 'Quarta' },
  { value: 4, label: 'Qui', fullLabel: 'Quinta' },
  { value: 5, label: 'Sex', fullLabel: 'Sexta' },
  { value: 6, label: 'Sáb', fullLabel: 'Sábado' },
];

const SLOT_DURATIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h 30min' },
  { value: 120, label: '2 horas' },
];

const BUFFER_OPTIONS = [
  { value: 0, label: 'Sem intervalo' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
];

export const AvailabilitySettings: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { isAdmin } = useCompanySettings();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<AvailabilityConfig>({
    scheduling_available_days: [1, 2, 3, 4],
    scheduling_start_time: '09:00',
    scheduling_end_time: '12:00',
    scheduling_slot_duration: 30,
    scheduling_buffer_between: 0,
    google_calendar_url: null,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('nina_settings')
        .select('scheduling_available_days, scheduling_start_time, scheduling_end_time, scheduling_slot_duration, scheduling_buffer_between, google_calendar_url')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig({
          scheduling_available_days: (data as any).scheduling_available_days || [1, 2, 3, 4],
          scheduling_start_time: (data as any).scheduling_start_time?.slice(0, 5) || '09:00',
          scheduling_end_time: (data as any).scheduling_end_time?.slice(0, 5) || '12:00',
          scheduling_slot_duration: (data as any).scheduling_slot_duration || 30,
          scheduling_buffer_between: (data as any).scheduling_buffer_between || 0,
          google_calendar_url: (data as any).google_calendar_url || null,
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem alterar as configurações');
      return;
    }

    setSaving(true);
    try {
      // Get existing settings ID
      const { data: existing } = await supabase
        .from('nina_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      const updateData = {
        scheduling_available_days: config.scheduling_available_days,
        scheduling_start_time: config.scheduling_start_time + ':00',
        scheduling_end_time: config.scheduling_end_time + ':00',
        scheduling_slot_duration: config.scheduling_slot_duration,
        scheduling_buffer_between: config.scheduling_buffer_between,
        google_calendar_url: config.google_calendar_url,
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('nina_settings')
          .update(updateData)
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('nina_settings')
          .insert(updateData);

        if (error) throw error;
      }

      toast.success('Configurações salvas com sucesso!');
      onClose?.();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setConfig(prev => ({
      ...prev,
      scheduling_available_days: prev.scheduling_available_days.includes(day)
        ? prev.scheduling_available_days.filter(d => d !== day)
        : [...prev.scheduling_available_days, day].sort((a, b) => a - b),
    }));
  };

  const generateTimeSlots = () => {
    const slots: string[] = [];
    const [startHour, startMin] = config.scheduling_start_time.split(':').map(Number);
    const [endHour, endMin] = config.scheduling_end_time.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    const slotSize = config.scheduling_slot_duration + config.scheduling_buffer_between;

    for (let min = startMinutes; min + config.scheduling_slot_duration <= endMinutes; min += slotSize) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }

    return slots;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  const timeSlots = generateTimeSlots();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-700/50">
        <div className="p-2 bg-cyan-500/10 rounded-lg">
          <Settings2 className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Disponibilidade para Agendamentos</h3>
          <p className="text-sm text-slate-400">Configure os dias e horários disponíveis para a IA agendar leads</p>
        </div>
      </div>

      {/* Days Selection */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          Dias Disponíveis
        </label>
        <div className="flex flex-wrap gap-2">
          {DAYS_OF_WEEK.map(day => (
            <button
              key={day.value}
              onClick={() => toggleDay(day.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                config.scheduling_available_days.includes(day.value)
                  ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
              }`}
              title={day.fullLabel}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time Range */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Horário de Início
          </label>
          <input
            type="time"
            value={config.scheduling_start_time}
            onChange={(e) => setConfig(prev => ({ ...prev, scheduling_start_time: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Horário de Término
          </label>
          <input
            type="time"
            value={config.scheduling_end_time}
            onChange={(e) => setConfig(prev => ({ ...prev, scheduling_end_time: e.target.value }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          />
        </div>
      </div>

      {/* Slot Duration & Buffer */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Duração do Slot</label>
          <select
            value={config.scheduling_slot_duration}
            onChange={(e) => setConfig(prev => ({ ...prev, scheduling_slot_duration: Number(e.target.value) }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          >
            {SLOT_DURATIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-300">Intervalo entre Slots</label>
          <select
            value={config.scheduling_buffer_between}
            onChange={(e) => setConfig(prev => ({ ...prev, scheduling_buffer_between: Number(e.target.value) }))}
            className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
          >
            {BUFFER_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Google Calendar Link */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
          <Link2 className="w-4 h-4 text-slate-400" />
          Link do Google Calendar (opcional)
        </label>
        <input
          type="url"
          value={config.google_calendar_url || ''}
          onChange={(e) => setConfig(prev => ({ ...prev, google_calendar_url: e.target.value || null }))}
          placeholder="https://calendar.app.google/..."
          className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none"
        />
        <p className="text-xs text-slate-500">
          Cole o link do seu Google Calendar Appointment Schedule para referência
        </p>
      </div>

      {/* Preview */}
      <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-3">
        <h4 className="text-sm font-medium text-slate-300">Prévia dos Horários Disponíveis</h4>
        <div className="flex flex-wrap gap-2">
          {config.scheduling_available_days.length === 0 ? (
            <span className="text-sm text-slate-500">Nenhum dia selecionado</span>
          ) : (
            config.scheduling_available_days.map(day => (
              <span key={day} className="text-xs px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded">
                {DAYS_OF_WEEK.find(d => d.value === day)?.fullLabel}
              </span>
            ))
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {timeSlots.length === 0 ? (
            <span className="text-sm text-slate-500">Nenhum slot disponível</span>
          ) : (
            timeSlots.map(slot => (
              <span key={slot} className="text-xs px-2 py-1 bg-slate-700/50 text-slate-300 rounded font-mono">
                {slot}
              </span>
            ))
          )}
        </div>
        <p className="text-xs text-slate-500">
          {timeSlots.length} slots de {config.scheduling_slot_duration} min disponíveis por dia
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-700/50">
        {onClose && (
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        )}
        <Button 
          onClick={handleSave} 
          disabled={saving || !isAdmin}
          className="flex items-center gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Salvar Configurações
        </Button>
      </div>

      {!isAdmin && (
        <p className="text-xs text-amber-400/80 text-center">
          Apenas administradores podem alterar as configurações de disponibilidade
        </p>
      )}
    </div>
  );
};
