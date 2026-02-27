import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ExternalLink, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { IntegrationSettingsData } from '@/hooks/useIntegrationSettings';
import EmailTemplatesManager from './EmailTemplatesManager';

interface AWSConfigModalProps {
  open: boolean;
  onClose: () => void;
  currentConfig: IntegrationSettingsData | null;
  onSave: (data: Partial<IntegrationSettingsData>) => Promise<void>;
}

const AWSConfigModal: React.FC<AWSConfigModalProps> = ({ open, onClose, currentConfig, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    access_key_id: currentConfig?.aws_access_key_id || '',
    secret_access_key: currentConfig?.aws_secret_access_key || '',
    region: currentConfig?.aws_region || 'us-east-1',
    email_from: currentConfig?.aws_ses_email_from || '',
    email_from_name: currentConfig?.aws_ses_email_from_name || 'PremaCar',
  });

  const webhookUrl = `${window.location.origin}/api/webhooks/ses/email-events`;

  const handleSave = async () => {
    if (!config.access_key_id || !config.secret_access_key || !config.email_from) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        aws_access_key_id: config.access_key_id,
        aws_secret_access_key: config.secret_access_key,
        aws_region: config.region,
        aws_ses_email_from: config.email_from,
        aws_ses_email_from_name: config.email_from_name,
        aws_ses_webhook_url: webhookUrl,
        aws_ses_enabled: true,
      });
      toast.success('AWS SES configurado com sucesso!');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-white max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">📧 AWS SES + Email Templates</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="credentials" className="mt-2">
          <TabsList className="bg-slate-800">
            <TabsTrigger value="credentials">🔑 Credenciais</TabsTrigger>
            <TabsTrigger value="templates">✉️ Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="credentials" className="space-y-4 mt-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-300">
              Configure o AWS SES para enviar emails.{' '}
              <a href="https://docs.aws.amazon.com/ses/" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                Documentação <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div>
              <Label className="text-slate-300">AWS Access Key ID *</Label>
              <Input
                value={config.access_key_id}
                onChange={(e) => setConfig({ ...config, access_key_id: e.target.value })}
                placeholder="AKIA..."
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">AWS Secret Access Key *</Label>
              <Input
                type="password"
                value={config.secret_access_key}
                onChange={(e) => setConfig({ ...config, secret_access_key: e.target.value })}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Região *</Label>
              <Select value={config.region} onValueChange={(v) => setConfig({ ...config, region: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="us-east-1">US East (N. Virginia)</SelectItem>
                  <SelectItem value="us-west-2">US West (Oregon)</SelectItem>
                  <SelectItem value="sa-east-1">South America (São Paulo)</SelectItem>
                  <SelectItem value="eu-west-1">Europe (Ireland)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Email Remetente *</Label>
              <Input
                value={config.email_from}
                onChange={(e) => setConfig({ ...config, email_from: e.target.value })}
                placeholder="contato@empresa.com.br"
                className="bg-slate-800 border-slate-700 mt-1"
              />
              <p className="text-xs text-amber-400 mt-1">⚠️ Este email deve estar verificado no AWS SES</p>
            </div>

            <div>
              <Label className="text-slate-300">Nome do Remetente</Label>
              <Input
                value={config.email_from_name}
                onChange={(e) => setConfig({ ...config, email_from_name: e.target.value })}
                placeholder="PremaCar"
                className="bg-slate-800 border-slate-700 mt-1"
              />
            </div>

            <div>
              <Label className="text-slate-300">Webhook URL (AWS SNS)</Label>
              <div className="flex gap-2 mt-1">
                <Input value={webhookUrl} readOnly className="bg-slate-800/50 border-slate-700 text-slate-400 text-xs" />
                <Button variant="outline" size="sm" className="border-slate-700 shrink-0" onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success('URL copiada!'); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Salvar Credenciais
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <EmailTemplatesManager />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AWSConfigModal;
