import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onClose: () => void;
  currentConfig: Record<string, any> | null;
  onSave: (updates: Record<string, any>) => Promise<void>;
}

const DAYS_AHEAD_OPTIONS = [3, 5, 7, 10, 14];
const SLOT_DURATION_OPTIONS = [15, 20, 30, 45, 60];
const BUFFER_OPTIONS = [0, 10, 15, 20, 30];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const GoogleCalendarConfigModal: React.FC<Props> = ({ open, onClose, currentConfig, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [serviceAccountJson, setServiceAccountJson] = useState('');
  const [calendarId, setCalendarId] = useState('primary');
  const [slotDuration, setSlotDuration] = useState(30);
  const [buffer, setBuffer] = useState(15);
  const [workStart, setWorkStart] = useState(9);
  const [workEnd, setWorkEnd] = useState(18);
  const [timezone, setTimezone] = useState('America/Sao_Paulo');
  const [daysAhead, setDaysAhead] = useState(7);

  useEffect(() => {
    if (currentConfig) {
      const sa = currentConfig.google_calendar_service_account_json;
      setServiceAccountJson(sa ? (typeof sa === 'string' ? sa : JSON.stringify(sa, null, 2)) : '');
      setCalendarId(currentConfig.google_calendar_id || 'primary');
      setSlotDuration(currentConfig.google_calendar_slot_duration ?? 30);
      setBuffer(currentConfig.google_calendar_buffer ?? 15);
      setWorkStart(currentConfig.google_calendar_work_start ?? 9);
      setWorkEnd(currentConfig.google_calendar_work_end ?? 18);
      setTimezone(currentConfig.google_calendar_timezone || 'America/Sao_Paulo');
      setDaysAhead(currentConfig.google_calendar_days_ahead ?? 7);
    }
  }, [currentConfig, open]);

  if (!open) return null;

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      // Validate JSON
      let parsedJson: Record<string, string> | null = null;
      if (serviceAccountJson.trim()) {
        try {
          parsedJson = JSON.parse(serviceAccountJson.trim());
          if (!parsedJson?.client_email || !parsedJson?.private_key) {
            throw new Error('JSON inválido: precisa ter client_email e private_key');
          }
        } catch (e: any) {
          throw new Error(`Service Account JSON inválido: ${e.message}`);
        }
      }

      await onSave({
        google_calendar_service_account_json: parsedJson,
        google_calendar_id: calendarId.trim() || 'primary',
        google_calendar_slot_duration: slotDuration,
        google_calendar_buffer: buffer,
        google_calendar_work_start: workStart,
        google_calendar_work_end: workEnd,
        google_calendar_timezone: timezone,
        google_calendar_days_ahead: daysAhead,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = !!currentConfig?.google_calendar_service_account_json;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-xl">
              📅
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Google Calendar</h2>
              <p className="text-sm text-slate-400">Agendamento automático de demos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConfigured && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Configurado
              </span>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* How it works */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <p className="text-sm text-blue-300 font-medium mb-1">Como funciona</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Quando um lead aceita agendar uma demo, a Cris busca automaticamente os horários livres
              do seu Google Calendar, apresenta as opções, coleta o e-mail e cria o evento com convite
              Google Meet — tudo sem intervenção humana.
            </p>
          </div>

          {/* Step 1: Service Account */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">1</span>
              <Label className="text-white text-sm font-medium">Service Account JSON</Label>
            </div>
            <p className="text-xs text-slate-400 ml-7">
              Crie uma Service Account no Google Cloud Console, habilite a Google Calendar API,
              adicione o e-mail da service account como editor no seu calendário, baixe a chave JSON e cole abaixo.
            </p>
            <Textarea
              value={serviceAccountJson}
              onChange={e => setServiceAccountJson(e.target.value)}
              placeholder='{"type":"service_account","project_id":"...","client_email":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}'
              className="bg-slate-800 border-slate-600 text-slate-200 text-xs font-mono h-28 resize-none placeholder:text-slate-600"
            />
          </div>

          {/* Step 2: Calendar ID */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">2</span>
              <Label className="text-white text-sm font-medium">Calendar ID</Label>
            </div>
            <p className="text-xs text-slate-400 ml-7">
              Use <code className="text-blue-300">primary</code> para o calendário principal
              ou o ID do calendário específico (encontre em Configurações do Google Calendar → ID do calendário).
            </p>
            <Input
              value={calendarId}
              onChange={e => setCalendarId(e.target.value)}
              placeholder="primary"
              className="bg-slate-800 border-slate-600 text-slate-200"
            />
          </div>

          {/* Step 3: Schedule settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">3</span>
              <Label className="text-white text-sm font-medium">Configurações de Agenda</Label>
            </div>

            <div className="ml-7 grid grid-cols-2 gap-4">
              {/* Working hours */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Horário início</label>
                <select
                  value={workStart}
                  onChange={e => setWorkStart(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-md text-slate-200 text-sm px-3 py-2"
                >
                  {HOURS.filter(h => h < workEnd).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Horário fim</label>
                <select
                  value={workEnd}
                  onChange={e => setWorkEnd(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-md text-slate-200 text-sm px-3 py-2"
                >
                  {HOURS.filter(h => h > workStart).map(h => (
                    <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                  ))}
                </select>
              </div>

              {/* Slot duration */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Duração da demo
                </label>
                <select
                  value={slotDuration}
                  onChange={e => setSlotDuration(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-md text-slate-200 text-sm px-3 py-2"
                >
                  {SLOT_DURATION_OPTIONS.map(d => (
                    <option key={d} value={d}>{d} minutos</option>
                  ))}
                </select>
              </div>

              {/* Buffer */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Buffer entre demos</label>
                <select
                  value={buffer}
                  onChange={e => setBuffer(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-md text-slate-200 text-sm px-3 py-2"
                >
                  {BUFFER_OPTIONS.map(b => (
                    <option key={b} value={b}>{b === 0 ? 'Sem buffer' : `${b} minutos`}</option>
                  ))}
                </select>
              </div>

              {/* Days ahead */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Dias disponíveis
                </label>
                <select
                  value={daysAhead}
                  onChange={e => setDaysAhead(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-md text-slate-200 text-sm px-3 py-2"
                >
                  {DAYS_AHEAD_OPTIONS.map(d => (
                    <option key={d} value={d}>{d} dias úteis</option>
                  ))}
                </select>
              </div>

              {/* Timezone */}
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400">Fuso horário</label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-md text-slate-200 text-sm px-3 py-2"
                >
                  <option value="America/Sao_Paulo">Brasília (UTC-3)</option>
                  <option value="America/Manaus">Manaus (UTC-4)</option>
                  <option value="America/Belem">Belém (UTC-3)</option>
                  <option value="America/Fortaleza">Fortaleza (UTC-3)</option>
                  <option value="America/Recife">Recife (UTC-3)</option>
                  <option value="America/Bahia">Salvador (UTC-3)</option>
                  <option value="America/Porto_Velho">Porto Velho (UTC-4)</option>
                  <option value="America/Boa_Vista">Boa Vista (UTC-4)</option>
                  <option value="America/Rio_Branco">Rio Branco (UTC-5)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-slate-700">
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !serviceAccountJson.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
            ) : saved ? (
              <><CheckCircle2 className="w-4 h-4" /> Salvo!</>
            ) : (
              'Salvar'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GoogleCalendarConfigModal;
