import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Info, ArrowLeft, Server, CheckCircle } from 'lucide-react';
import type { WhatsAppConnection } from '@/hooks/useWhatsAppConnections';
import { api } from '@/services/api';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || '';

interface ConnectionModalProps {
  connection: WhatsAppConnection | null;
  onClose: () => void;
  onSave: (data: Partial<WhatsAppConnection>) => Promise<boolean>;
}

type Provider = 'evolution' | 'meta_official';

// ── Passo 1: escolha de provider ─────────────────────────────────────────────
function ProviderStep({ onSelect }: { onSelect: (p: Provider) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Escolha o tipo de API para esta conexão WhatsApp:
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect('evolution')}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border border-slate-700 hover:border-green-500/50 hover:bg-green-500/5 transition-all group text-left"
        >
          <div className="w-12 h-12 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center group-hover:bg-green-500/30 transition-colors">
            <Server className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Evolution API</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Self-hosted, sem limite de mensagens
            </p>
          </div>
        </button>

        <button
          onClick={() => onSelect('meta_official')}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group text-left"
        >
          <div className="w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
            <CheckCircle className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Meta Oficial</p>
            <p className="text-xs text-slate-400 mt-0.5">
              WhatsApp Business API oficial
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

// ── Passo 2: formulário ───────────────────────────────────────────────────────
interface FormStepProps {
  provider: Provider;
  data: Record<string, any>;
  onChange: (d: Record<string, any>) => void;
  queues: Array<{ id: string; name: string }>;
}

function FormStep({ provider, data, onChange, queues }: FormStepProps) {
  const metaWebhookUrl = SUPABASE_URL
    ? `${SUPABASE_URL}/functions/v1/meta-webhook`
    : '';

  const set = (key: string, value: any) => onChange({ ...data, [key]: value });

  return (
    <div className="space-y-4">
      {/* Campos comuns */}
      <div className="space-y-2">
        <Label>Nome da Conexão *</Label>
        <Input
          value={data.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder={provider === 'evolution' ? 'Ex: Atendimento, Vendas' : 'Ex: WhatsApp Oficial'}
        />
        <p className="text-xs text-slate-500">Este nome aparecerá no chat e nos seletores</p>
      </div>

      <div className="space-y-2">
        <Label>Número WhatsApp *</Label>
        <Input
          value={data.phone_number}
          onChange={(e) => set('phone_number', e.target.value)}
          placeholder="+5547999999999"
        />
      </div>

      <div className="space-y-2">
        <Label>Fila Padrão</Label>
        <Select
          value={data.default_queue_id ?? '__none__'}
          onValueChange={(v) => set('default_queue_id', v === '__none__' ? null : v)}
        >
          <SelectTrigger className="bg-slate-800 border-slate-700">
            <SelectValue placeholder="Nenhuma" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="__none__">Nenhuma</SelectItem>
            {queues.map((q) => (
              <SelectItem key={q.id} value={q.id}>{q.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">Novas conversas entram automaticamente nessa fila</p>
      </div>

      {/* Campos Evolution */}
      {provider === 'evolution' && (
        <>
          <div className="border-t border-slate-800 pt-3">
            <p className="text-xs font-medium text-green-400 mb-3 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5" />
              Credenciais Evolution API
            </p>
          </div>
          <div className="space-y-2">
            <Label>URL da API *</Label>
            <Input
              value={data.evolution_base_url}
              onChange={(e) => set('evolution_base_url', e.target.value)}
              placeholder="https://evolution-api.com"
            />
          </div>
          <div className="space-y-2">
            <Label>API Key *</Label>
            <Input
              type="password"
              value={data.evolution_api_key}
              onChange={(e) => set('evolution_api_key', e.target.value)}
              placeholder="xxxxxxxxxx"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome da Instância *</Label>
            <Input
              value={data.evolution_instance_name}
              onChange={(e) => set('evolution_instance_name', e.target.value)}
              placeholder="premacar-atendimento"
            />
            <p className="text-xs text-slate-500">
              O nome da instância criada na sua Evolution API
            </p>
          </div>
        </>
      )}

      {/* Campos Meta */}
      {provider === 'meta_official' && (
        <>
          <div className="border-t border-slate-800 pt-3">
            <p className="text-xs font-medium text-blue-400 mb-3 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Credenciais Meta WhatsApp Business API
            </p>
          </div>

          {metaWebhookUrl && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 space-y-1">
              <p className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" />
                Configure este webhook no Meta Business Manager
              </p>
              <p className="text-xs font-mono text-slate-300 break-all select-all">
                {metaWebhookUrl}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Phone Number ID *</Label>
            <Input
              value={data.meta_phone_number_id}
              onChange={(e) => set('meta_phone_number_id', e.target.value)}
              placeholder="1234567890"
            />
          </div>
          <div className="space-y-2">
            <Label>Access Token *</Label>
            <Input
              type="password"
              value={data.meta_access_token}
              onChange={(e) => set('meta_access_token', e.target.value)}
              placeholder="EAA..."
            />
          </div>
          <div className="space-y-2">
            <Label>Business Account ID</Label>
            <Input
              value={data.meta_business_account_id}
              onChange={(e) => set('meta_business_account_id', e.target.value)}
              placeholder="1234567890"
            />
          </div>
          <div className="space-y-2">
            <Label>App Secret</Label>
            <Input
              type="password"
              value={data.meta_app_secret}
              onChange={(e) => set('meta_app_secret', e.target.value)}
              placeholder="Assina e verifica webhooks"
            />
            <p className="text-xs text-slate-500">Meta for Developers → App → App Secret</p>
          </div>
          <div className="space-y-2">
            <Label>Verify Token</Label>
            <Input
              value={data.meta_verify_token}
              onChange={(e) => set('meta_verify_token', e.target.value)}
              placeholder="token-personalizado-123"
            />
            <p className="text-xs text-slate-500">
              Defina qualquer string — use o mesmo ao configurar o webhook no Meta
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Modal principal ──────────────────────────────────────────────────────────
export function ConnectionModal({ connection, onClose, onSave }: ConnectionModalProps) {
  const isEditing = !!connection;
  const [saving, setSaving] = useState(false);
  const [queues, setQueues] = useState<Array<{ id: string; name: string; color: string }>>([]);

  // Ao editar, começa direto no formulário com o provider já definido
  const [step, setStep] = useState<'provider' | 'form'>(isEditing ? 'form' : 'provider');
  const [provider, setProvider] = useState<Provider>(
    (connection?.api_type as Provider) || 'evolution'
  );

  const [data, setData] = useState({
    name: connection?.name || '',
    phone_number: connection?.phone_number || '',
    api_type: connection?.api_type || 'evolution',
    evolution_instance_name: connection?.evolution_instance_name || '',
    evolution_api_key: connection?.evolution_api_key || '',
    evolution_base_url: connection?.evolution_base_url || 'https://evolution-api.com',
    meta_phone_number_id: connection?.meta_phone_number_id || '',
    meta_access_token: connection?.meta_access_token || '',
    meta_business_account_id: connection?.meta_business_account_id || '',
    meta_app_secret: connection?.meta_app_secret || '',
    meta_verify_token: connection?.meta_verify_token || '',
    default_queue_id: connection?.default_queue_id ?? null as string | null,
  });

  useEffect(() => {
    api.fetchQueues().then((d: any) => setQueues(d)).catch(() => {});
  }, []);

  const handleProviderSelect = (p: Provider) => {
    setProvider(p);
    setData((prev) => ({ ...prev, api_type: p }));
    setStep('form');
  };

  const handleSave = async () => {
    if (!data.name || !data.phone_number) return;
    setSaving(true);
    const success = await onSave({ ...data, api_type: provider });
    setSaving(false);
    if (success) onClose();
  };

  const canSave = data.name.trim() && data.phone_number.trim();

  const title = isEditing
    ? `Editar: ${connection!.name}`
    : step === 'provider'
    ? 'Nova Conexão'
    : provider === 'evolution'
    ? 'Configurar Evolution API'
    : 'Configurar Meta Oficial';

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            {step === 'form' && !isEditing && (
              <button
                onClick={() => setStep('provider')}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            {title}
          </DialogTitle>
          {step === 'provider' && (
            <DialogDescription className="text-slate-400">
              Escolha o tipo de integração para esta conexão WhatsApp.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="mt-2">
          {step === 'provider' ? (
            <ProviderStep onSelect={handleProviderSelect} />
          ) : (
            <>
              <FormStep
                provider={provider}
                data={data}
                onChange={setData}
                queues={queues}
              />
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="ghost" onClick={onClose}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving || !canSave}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  {isEditing ? 'Atualizar' : 'Criar'} Conexão
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
