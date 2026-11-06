import React from 'react';
import { Bell, Volume2, PlayCircle } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Button } from '../Button';
import {
  useNotificationSettings,
  SOUND_TYPE_LABELS,
  NotificationSoundType,
} from '@/hooks/useNotificationSettings';

const NotificationSettings: React.FC = () => {
  const { enabled, volume, soundType, setEnabled, setVolume, setSoundType, playTestSound } = useNotificationSettings();

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Notificações
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Controla o som e o alerta visual quando uma nova mensagem chega no Chat. Essa preferência fica salva neste navegador.
        </p>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-5 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-100">Ativar notificações</p>
            <p className="text-xs text-slate-400 mt-0.5">Som e notificação do navegador para mensagens novas</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>

        <div className={`space-y-2 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-100 flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              Volume
            </label>
            <span className="text-xs text-slate-400 font-mono">{volume}%</span>
          </div>
          <Slider
            value={[volume]}
            onValueChange={([v]) => setVolume(v)}
            min={0}
            max={100}
            step={5}
            disabled={!enabled}
          />
        </div>

        <div className={`space-y-2 ${!enabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <label className="text-sm font-medium text-slate-100">Tipo de som</label>
          <div className="flex gap-2">
            <Select value={soundType} onValueChange={(v) => setSoundType(v as NotificationSoundType)} disabled={!enabled}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SOUND_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" onClick={playTestSound} disabled={!enabled} className="gap-2 shrink-0">
              <PlayCircle className="w-4 h-4" />
              Testar som
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
