import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Smartphone,
  CheckCircle,
  XCircle,
  Loader2,
  Pencil,
  Trash2,
  Wifi,
  WifiOff,
  QrCode,
  Star,
  Copy,
  ExternalLink,
  RefreshCw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  useWhatsAppConnections,
  WhatsAppConnection,
} from '@/hooks/useWhatsAppConnections';
import { ConnectionModal } from './ConnectionModal';
import { toast } from 'sonner';

const MAX_CONNECTIONS = 4;

// ── Modal QR Code ─────────────────────────────────────────────────────────────
interface QrModalProps {
  connection: WhatsAppConnection;
  onClose: () => void;
  getQrCode: (id: string) => Promise<{ base64: string | null; already_connected?: boolean; error?: string }>;
  refetch: () => void;
}

function QrCodeModal({ connection, onClose, getQrCode, refetch }: QrModalProps) {
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alreadyConnected, setAlreadyConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchQr = async () => {
    setLoading(true);
    setError(null);
    const result = await getQrCode(connection.id);
    setLoading(false);
    if (result.already_connected) {
      setAlreadyConnected(true);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    setQrBase64(result.base64);
  };

  useEffect(() => {
    fetchQr();
    // Atualiza o QR a cada 28 segundos (QR expira em ~30s na Evolution API)
    intervalRef.current = setInterval(fetchQr, 28_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  if (alreadyConnected) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              Conectado!
            </DialogTitle>
          </DialogHeader>
          <p className="text-slate-400 text-sm py-2">
            {connection.name} já está conectada e pronta para usar.
          </p>
          <Button onClick={onClose}>Fechar</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <QrCode className="w-5 h-5 text-cyan-400" />
            Conectar {connection.name}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Abra o WhatsApp → Menu → Aparelhos Conectados → Conectar aparelho
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {loading ? (
            <div className="w-64 h-64 flex items-center justify-center bg-slate-800 rounded-xl">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            </div>
          ) : error ? (
            <div className="w-64 text-center space-y-2">
              <XCircle className="w-10 h-10 text-red-400 mx-auto" />
              <p className="text-sm text-red-400">{error}</p>
              <Button size="sm" variant="ghost" onClick={fetchQr} className="gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar novamente
              </Button>
            </div>
          ) : qrBase64 ? (
            <>
              <div className="p-2 bg-white rounded-xl">
                <img
                  src={qrBase64}
                  alt="QR Code WhatsApp"
                  className="w-60 h-60 object-contain"
                />
              </div>
              <p className="text-xs text-slate-500 text-center">
                QR expira em ~30s — atualiza automaticamente
              </p>
            </>
          ) : null}

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchQr}
            disabled={loading}
            className="gap-1.5 text-slate-400"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar QR
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export function ConnectionsManager() {
  const {
    connections,
    loading,
    refetch,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    setDefaultConnection,
    getQrCode,
  } = useWhatsAppConnections();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<WhatsAppConnection | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [qrConnection, setQrConnection] = useState<WhatsAppConnection | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState('');

  useEffect(() => {
    const url = (import.meta.env.VITE_SUPABASE_URL as string) || '';
    setSupabaseUrl(url);
  }, []);

  const metaWebhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/meta-webhook` : '';

  const handleTest = async (id: string) => {
    setTestingId(id);
    await testConnection(id);
    setTestingId(null);
  };

  const handleSave = async (data: Partial<WhatsAppConnection>) => {
    if (editingConnection) {
      return updateConnection(editingConnection.id, data);
    }
    return createConnection(data);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success('Copiado!'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            Conexões WhatsApp
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Gerencie múltiplas linhas de atendimento ({connections.length}/{MAX_CONNECTIONS})
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingConnection(null);
            setModalOpen(true);
          }}
          disabled={connections.filter(c => !c.id.startsWith('__legacy_')).length >= MAX_CONNECTIONS}
          className="gap-2"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Nova Conexão
        </Button>
      </div>

      {/* Connection Cards */}
      <div className="grid gap-4">
        {connections.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma conexão configurada</p>
            <p className="text-xs mt-1 opacity-70">
              Adicione sua primeira conexão WhatsApp
            </p>
          </div>
        ) : (
          connections.map((conn) => (
            <div
              key={conn.id}
              className={`p-4 rounded-xl border transition-all ${
                conn.is_default
                  ? 'bg-slate-800/70 border-cyan-500/30'
                  : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
              }`}
            >
              {/* Top row: avatar + name + status badges */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      conn.is_connected
                        ? 'bg-green-500/20 border border-green-500/30'
                        : 'bg-slate-700/50 border border-slate-600'
                    }`}
                  >
                    <Smartphone
                      className={`w-5 h-5 ${conn.is_connected ? 'text-green-400' : 'text-slate-400'}`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-white">{conn.name}</p>
                      {conn.is_default && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                          padrão
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono">{conn.phone_number}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {conn.is_connected ? (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-green-500/20 text-green-400 border border-green-500/30 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Conectado
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                      <XCircle className="w-3 h-3" />
                      Desconectado
                    </span>
                  )}
                </div>
              </div>

              {/* Info row */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span>
                  Tipo:{' '}
                  <span className="text-slate-300">
                    {conn.api_type === 'evolution' ? '🔧 Evolution API' : '✅ Meta Official'}
                  </span>
                </span>
                {conn.api_type === 'evolution' && conn.evolution_instance_name && (
                  <span>
                    Instância:{' '}
                    <span className="text-slate-300 font-mono">{conn.evolution_instance_name}</span>
                  </span>
                )}
                {conn.api_type === 'meta_official' && conn.meta_phone_number_id && (
                  <span>
                    Phone ID:{' '}
                    <span className="text-slate-300 font-mono">{conn.meta_phone_number_id}</span>
                  </span>
                )}
              </div>

              {/* Meta webhook URL info */}
              {conn.api_type === 'meta_official' && metaWebhookUrl && !conn.id.startsWith('__legacy_') && (
                <div className="mt-3 p-2.5 rounded-lg bg-slate-900/60 border border-slate-700/40 flex items-center gap-2">
                  <span className="text-xs text-slate-400 shrink-0">Webhook:</span>
                  <span className="text-xs font-mono text-slate-300 truncate flex-1">{metaWebhookUrl}</span>
                  <button
                    onClick={() => copyToClipboard(metaWebhookUrl)}
                    className="shrink-0 text-slate-500 hover:text-cyan-400 transition-colors"
                    title="Copiar URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <a
                    href="https://developers.facebook.com/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-slate-500 hover:text-cyan-400 transition-colors"
                    title="Abrir Meta for Developers"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {/* Actions */}
              {conn.id.startsWith('__legacy_') ? (
                <div className="mt-3 text-xs text-slate-400/70 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
                  Detectada pelas credenciais acima. Para gerenciar individualmente, adicione como nova conexão e limpe os campos de API acima.
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-1 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white gap-1.5 h-8"
                    onClick={() => {
                      setEditingConnection(conn);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Editar
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-cyan-400 gap-1.5 h-8"
                    onClick={() => handleTest(conn.id)}
                    disabled={testingId === conn.id}
                  >
                    {testingId === conn.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : conn.is_connected ? (
                      <Wifi className="w-3.5 h-3.5" />
                    ) : (
                      <WifiOff className="w-3.5 h-3.5" />
                    )}
                    Testar
                  </Button>

                  {conn.api_type === 'evolution' && !conn.is_connected && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-purple-400 gap-1.5 h-8"
                      onClick={() => setQrConnection(conn)}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Ver QR Code
                    </Button>
                  )}

                  {!conn.is_default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-yellow-400 gap-1.5 h-8"
                      onClick={() => setDefaultConnection(conn.id)}
                    >
                      <Star className="w-3.5 h-3.5" />
                      Definir padrão
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-red-400 gap-1.5 h-8 ml-auto"
                    onClick={() => deleteConnection(conn.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal Criar/Editar */}
      {modalOpen && (
        <ConnectionModal
          connection={editingConnection}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* Modal QR Code */}
      {qrConnection && (
        <QrCodeModal
          connection={qrConnection}
          onClose={() => setQrConnection(null)}
          getQrCode={getQrCode}
          refetch={refetch}
        />
      )}
    </div>
  );
}
