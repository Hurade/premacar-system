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
import { Loader2, Info } from 'lucide-react';
import type { WhatsAppConnection } from '@/hooks/useWhatsAppConnections';
import { api } from '@/services/api';

interface ConnectionModalProps {
  connection: WhatsAppConnection | null;
  onClose: () => void;
  onSave: (data: Partial<WhatsAppConnection>) => Promise<boolean>;
}

export function ConnectionModal({ connection, onClose, onSave }: ConnectionModalProps) {
  const [saving, setSaving] = useState(false);
  const [queues, setQueues] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
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

  const metaWebhookUrl = supabaseUrl
    ? `${supabaseUrl}/functions/v1/meta-webhook`
    : '';

  const handleSave = async () => {
    if (!data.name || !data.phone_number) return;
    setSaving(true);
    const success = await onSave(data as any);
    setSaving(false);
    if (success) onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {connection ? 'Editar Conexão' : 'Nova Conexão WhatsApp'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Configure os dados da conexão WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Conexão *</Label>
            <Input
              value={data.name}
              onChange={(e) => setData({ ...data, name: e.target.value })}
              placeholder="Ex: Atendimento, Vendas, Suporte"
            />
            <p className="text-xs text-slate-500">Esse nome aparecerá no chat</p>
          </div>

          <div className="space-y-2">
            <Label>Número WhatsApp *</Label>
            <Input
              value={data.phone_number}
              onChange={(e) => setData({ ...data, phone_number: e.target.value })}
              placeholder="+5547999999999"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de API *</Label>
            <Select
              value={data.api_type}
              onValueChange={(v) => setData({ ...data, api_type: v as any })}
            >
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700">
                <SelectItem value="evolution">🔧 Evolution API</SelectItem>
                <SelectItem value="meta_official">✅ Meta Official API</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fila Padrão</Label>
            <Select
              value={data.default_queue_id ?? '__none__'}
              onValueChange={(v) => setData({ ...data, default_queue_id: v === '__none__' ? null : v })}
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
            <p className="text-xs text-slate-500">
              Conversas novas nesta conexão entram automaticamente nessa fila
            </p>
          </div>

          {data.api_type === 'evolution' && (
            <>
              <div className="space-y-2">
                <Label>Nome da Instância *</Label>
                <Input
                  value={data.evolution_instance_name}
                  onChange={(e) =>
                    setData({ ...data, evolution_instance_name: e.target.value })
                  }
                  placeholder="premacar-atendimento"
                />
              </div>
              <div className="space-y-2">
                <Label>API Key *</Label>
                <Input
                  type="password"
                  value={data.evolution_api_key}
                  onChange={(e) =>
                    setData({ ...data, evolution_api_key: e.target.value })
                  }
                  placeholder="xxxxxxxxxx"
                />
              </div>
              <div className="space-y-2">
                <Label>URL Base Evolution</Label>
                <Input
                  value={data.evolution_base_url}
                  onChange={(e) =>
                    setData({ ...data, evolution_base_url: e.target.value })
                  }
                  placeholder="https://evolution-api.com"
                />
              </div>
            </>
          )}

          {data.api_type === 'meta_official' && (
            <>
              {metaWebhookUrl && (
                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 space-y-1">
                  <p className="text-xs font-medium text-cyan-400 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    URL do Webhook (configure no Meta Business Manager)
                  </p>
                  <p className="text-xs font-mono text-slate-300 break-all">{metaWebhookUrl}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Phone Number ID *</Label>
                <Input
                  value={data.meta_phone_number_id}
                  onChange={(e) =>
                    setData({ ...data, meta_phone_number_id: e.target.value })
                  }
                  placeholder="1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label>Access Token *</Label>
                <Input
                  type="password"
                  value={data.meta_access_token}
                  onChange={(e) =>
                    setData({ ...data, meta_access_token: e.target.value })
                  }
                  placeholder="EAA..."
                />
              </div>
              <div className="space-y-2">
                <Label>Business Account ID</Label>
                <Input
                  value={data.meta_business_account_id}
                  onChange={(e) =>
                    setData({ ...data, meta_business_account_id: e.target.value })
                  }
                  placeholder="1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label>App Secret</Label>
                <Input
                  type="password"
                  value={data.meta_app_secret}
                  onChange={(e) =>
                    setData({ ...data, meta_app_secret: e.target.value })
                  }
                  placeholder="Usado para verificar assinatura do webhook"
                />
                <p className="text-xs text-slate-500">
                  Encontrado em Meta for Developers → seu app → App Secret
                </p>
              </div>
              <div className="space-y-2">
                <Label>Verify Token</Label>
                <Input
                  value={data.meta_verify_token}
                  onChange={(e) =>
                    setData({ ...data, meta_verify_token: e.target.value })
                  }
                  placeholder="Token personalizado para verificação do webhook"
                />
                <p className="text-xs text-slate-500">
                  Defina qualquer string — use o mesmo valor ao configurar o webhook no Meta
                </p>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !data.name || !data.phone_number}>
            {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {connection ? 'Atualizar' : 'Criar'} Conexão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
