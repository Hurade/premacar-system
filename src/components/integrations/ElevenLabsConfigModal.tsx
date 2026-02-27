import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { ExternalLink, Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';
import { IntegrationSettingsData } from '@/hooks/useIntegrationSettings';

interface ElevenLabsConfigModalProps {
  open: boolean;
  onClose: () => void;
  currentConfig: IntegrationSettingsData | null;
  onSave: (data: Partial<IntegrationSettingsData>) => Promise<void>;
}

const POPULAR_VOICES = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (Feminina, suave)' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura (Feminina, profissional)' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Masculina, grave)' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam (Masculina, jovem)' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily (Feminina, energética)' },
];

const ElevenLabsConfigModal: React.FC<ElevenLabsConfigModalProps> = ({ open, onClose, currentConfig, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    api_key: currentConfig?.elevenlabs_api_key_integration || '',
    voice_id: currentConfig?.elevenlabs_voice_id_integration || 'EXAVITQu4vr4xnSDxMaL',
  });

  const handleSave = async () => {
    if (!config.api_key) {
      toast.error('Preencha a API Key');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        elevenlabs_api_key_integration: config.api_key,
        elevenlabs_voice_id_integration: config.voice_id,
        elevenlabs_enabled: true,
      });
      toast.success('ElevenLabs configurado com sucesso!');
      onClose();
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">🎙️ Configurar ElevenLabs</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-300">
            ElevenLabs gera voz AI ultra-realista para suas ligações.{' '}
            <a href="https://elevenlabs.io" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
              Criar conta <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <Label className="text-slate-300">API Key *</Label>
            <Input
              type="password"
              value={config.api_key}
              onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
              placeholder="sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="bg-slate-800 border-slate-700 mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Profile → API Keys → Create new key</p>
          </div>

          <div>
            <Label className="text-slate-300">Voz *</Label>
            <div className="space-y-2 mt-1">
              {POPULAR_VOICES.map((voice) => (
                <label
                  key={voice.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    config.voice_id === voice.id
                      ? 'border-cyan-500/50 bg-cyan-500/10'
                      : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="voice"
                    value={voice.id}
                    checked={config.voice_id === voice.id}
                    onChange={() => setConfig({ ...config, voice_id: voice.id })}
                    className="accent-cyan-500"
                  />
                  <Volume2 className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-200">{voice.name}</span>
                </label>
              ))}
            </div>
            <div className="mt-2">
              <Label className="text-slate-400 text-xs">Ou cole um Voice ID customizado:</Label>
              <Input
                value={config.voice_id}
                onChange={(e) => setConfig({ ...config, voice_id: e.target.value })}
                placeholder="Voice ID"
                className="bg-slate-800 border-slate-700 mt-1 text-xs"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
            ℹ️ O script das ligações usará automaticamente o prompt do agente que já está configurado no sistema.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ElevenLabsConfigModal;
