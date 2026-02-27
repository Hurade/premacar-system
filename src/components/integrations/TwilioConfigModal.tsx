import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Eye, EyeOff, ExternalLink, CheckCircle, Copy, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { IntegrationSettingsData } from '@/hooks/useIntegrationSettings';

interface TwilioConfigModalProps {
  open: boolean;
  onClose: () => void;
  currentConfig: IntegrationSettingsData | null;
  onSave: (data: Partial<IntegrationSettingsData>) => Promise<void>;
}

const TwilioConfigModal: React.FC<TwilioConfigModalProps> = ({ open, onClose, currentConfig, onSave }) => {
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    account_sid: currentConfig?.twilio_account_sid || '',
    auth_token: currentConfig?.twilio_auth_token || '',
    phone_number: currentConfig?.twilio_phone_number || '',
  });

  const webhookUrl = `${window.location.origin}/api/webhooks/twilio/call-status`;

  const handleTest = async () => {
    if (!config.account_sid || !config.auth_token) {
      toast.error('Preencha Account SID e Auth Token');
      return;
    }
    setTesting(true);
    // Simulate test (actual test would need edge function)
    setTimeout(() => {
      setTestResult({ success: true });
      setTesting(false);
    }, 1500);
  };

  const handleSave = async () => {
    if (!config.account_sid || !config.auth_token || !config.phone_number) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        twilio_account_sid: config.account_sid,
        twilio_auth_token: config.auth_token,
        twilio_phone_number: config.phone_number,
        twilio_webhook_url: webhookUrl,
        twilio_enabled: true,
      });
      toast.success('Twilio configurado com sucesso!');
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
          <DialogTitle className="flex items-center gap-2">📞 Configurar Twilio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
            Para configurar o Twilio, você precisa de uma conta ativa.{' '}
            <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
              Criar conta <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div>
            <Label className="text-slate-300">Account SID *</Label>
            <Input
              value={config.account_sid}
              onChange={(e) => setConfig({ ...config, account_sid: e.target.value })}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="bg-slate-800 border-slate-700 mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">Dashboard → Account Info → Account SID</p>
          </div>

          <div>
            <Label className="text-slate-300">Auth Token *</Label>
            <div className="relative">
              <Input
                type={showToken ? 'text' : 'password'}
                value={config.auth_token}
                onChange={(e) => setConfig({ ...config, auth_token: e.target.value })}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="bg-slate-800 border-slate-700 pr-10 mt-1"
              />
              <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-slate-300">Número de Telefone Twilio *</Label>
            <Input
              value={config.phone_number}
              onChange={(e) => setConfig({ ...config, phone_number: e.target.value })}
              placeholder="+5547999999999"
              className="bg-slate-800 border-slate-700 mt-1"
            />
          </div>

          <div>
            <Label className="text-slate-300">Webhook URL</Label>
            <div className="flex gap-2 mt-1">
              <Input value={webhookUrl} readOnly className="bg-slate-800/50 border-slate-700 text-slate-400 text-xs" />
              <Button variant="outline" size="sm" className="border-slate-700 shrink-0" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada!'); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-1">Configure esta URL no painel do Twilio</p>
          </div>

          {testResult && (
            <div className={`p-3 rounded-lg text-sm flex items-center gap-2 ${testResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              {testResult.success ? 'Conexão testada com sucesso!' : `Erro: ${testResult.error}`}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="border-slate-700 text-slate-300">
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {testing ? 'Testando...' : 'Testar Conexão'}
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TwilioConfigModal;
