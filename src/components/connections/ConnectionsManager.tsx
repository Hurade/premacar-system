import { useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useWhatsAppConnections,
  WhatsAppConnection,
} from '@/hooks/useWhatsAppConnections';
import { ConnectionModal } from './ConnectionModal';

const MAX_CONNECTIONS = 4;

export function ConnectionsManager() {
  const {
    connections,
    loading,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
  } = useWhatsAppConnections();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] =
    useState<WhatsAppConnection | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

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
          disabled={connections.length >= MAX_CONNECTIONS}
          className="gap-2"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Nova Conexão
        </Button>
      </div>

      {connections.length >= MAX_CONNECTIONS && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
          Limite máximo de {MAX_CONNECTIONS} conexões atingido.
        </div>
      )}

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
              className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-all"
            >
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
                      className={`w-5 h-5 ${
                        conn.is_connected ? 'text-green-400' : 'text-slate-400'
                      }`}
                    />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{conn.name}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {conn.phone_number}
                    </p>
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

              <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                <span>
                  Tipo:{' '}
                  <span className="text-slate-300">
                    {conn.api_type === 'evolution'
                      ? '🔧 Evolution API'
                      : '✅ Meta Official'}
                  </span>
                </span>
                {conn.api_type === 'evolution' && conn.evolution_instance_name && (
                  <span>
                    Instância:{' '}
                    <span className="text-slate-300 font-mono">
                      {conn.evolution_instance_name}
                    </span>
                  </span>
                )}
              </div>

              {conn.id.startsWith('__legacy_') ? (
                <div className="mt-3 text-xs text-slate-400/70 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2">
                  Detectada pelas credenciais acima. Para gerenciar individualmente, adicione como nova conexão e limpe os campos de API acima.
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-2">
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

      {/* Modal */}
      {modalOpen && (
        <ConnectionModal
          connection={editingConnection}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
