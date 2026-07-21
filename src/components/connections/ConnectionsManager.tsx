import { useState } from 'react';
import {
  Plus,
  Smartphone,
  Loader2,
  Pencil,
  Trash2,
  Wifi,
  WifiOff,
  Star,
  Server,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  useWhatsAppConnections,
  WhatsAppConnection,
} from '@/hooks/useWhatsAppConnections';
import { ConnectionModal } from './ConnectionModal';

const MAX_CONNECTIONS = 4;

// ── Ícone do provider ─────────────────────────────────────────────────────────
function ProviderIcon({ apiType, size = 'md' }: { apiType: string; size?: 'sm' | 'md' }) {
  const isEvolution = apiType === 'evolution';
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const iconDim = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center shrink-0 ${
        isEvolution
          ? 'bg-green-500/20 border border-green-500/30'
          : 'bg-blue-500/20 border border-blue-500/30'
      }`}
    >
      {isEvolution ? (
        <Server className={`${iconDim} text-green-400`} />
      ) : (
        <CheckCircle2 className={`${iconDim} text-blue-400`} />
      )}
    </div>
  );
}

// ── Badge de status ────────────────────────────────────────────────────────────
function StatusBadge({ connected }: { connected: boolean }) {
  return connected ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-500/15 text-green-400 border border-green-500/25 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
      Conectado
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/25 whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
      Desconectado
    </span>
  );
}

// ── Card de conexão ────────────────────────────────────────────────────────────
interface CardProps {
  conn: WhatsAppConnection;
  testingId: string | null;
  onEdit: () => void;
  onTest: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

function ConnectionCard({ conn, testingId, onEdit, onTest, onSetDefault, onDelete }: CardProps) {
  const isLegacy = conn.id.startsWith('__legacy_');
  const isTesting = testingId === conn.id;
  const label = conn.api_type === 'evolution' ? 'Evolution API' : 'Meta Oficial';

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
        conn.is_default
          ? 'bg-slate-800/80 border-cyan-500/25'
          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600/60'
      }`}
    >
      {/* Ícone provider */}
      <ProviderIcon apiType={conn.api_type} />

      {/* Info — cresce para ocupar espaço disponível */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white text-sm truncate">{conn.name}</span>
          {conn.is_default && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
              padrão
            </span>
          )}
          <StatusBadge connected={!!conn.is_connected} />
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
          {conn.phone_number && (
            <span className="font-mono">{conn.phone_number}</span>
          )}
          {conn.phone_number && <span>·</span>}
          <span>{label}</span>
          {conn.api_type === 'evolution' && conn.evolution_instance_name && (
            <>
              <span>·</span>
              <span className="font-mono truncate max-w-[120px]">{conn.evolution_instance_name}</span>
            </>
          )}
        </div>
      </div>

      {/* Ações */}
      {isLegacy ? (
        <span className="text-xs text-slate-500 italic shrink-0">legado</span>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onEdit}
            title="Editar"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onTest}
            disabled={isTesting}
            title="Testar conexão"
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-700/60 transition-colors disabled:opacity-40"
          >
            {isTesting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : conn.is_connected ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
          </button>

          {!conn.is_default && (
            <button
              onClick={onSetDefault}
              title="Definir como padrão"
              className="p-1.5 rounded-lg text-slate-400 hover:text-yellow-400 hover:bg-slate-700/60 transition-colors"
            >
              <Star className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onDelete}
            title="Remover"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700/60 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export function ConnectionsManager() {
  const {
    connections,
    loading,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    setDefaultConnection,
  } = useWhatsAppConnections();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<WhatsAppConnection | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const realConnections = connections.filter(c => !c.id.startsWith('__legacy_'));
  const canAddMore = realConnections.length < MAX_CONNECTIONS;

  const handleTest = async (id: string) => {
    setTestingId(id);
    await testConnection(id);
    setTestingId(null);
  };

  const handleSave = async (data: Partial<WhatsAppConnection>) => {
    if (editingConnection) return updateConnection(editingConnection.id, data);
    return createConnection(data);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-cyan-400" />
            Conexões WhatsApp
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">
            {realConnections.length} {realConnections.length === 1 ? 'conexão configurada' : 'conexões configuradas'}
          </p>
        </div>
        <Button
          onClick={() => { setEditingConnection(null); setModalOpen(true); }}
          disabled={!canAddMore}
          size="sm"
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Conexão
        </Button>
      </div>

      {!canAddMore && (
        <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          Limite de {MAX_CONNECTIONS} conexões atingido.
        </div>
      )}

      {/* Lista */}
      {connections.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Smartphone className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Nenhuma conexão configurada</p>
          <p className="text-xs mt-1 opacity-60">Clique em "Nova Conexão" para começar</p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              conn={conn}
              testingId={testingId}
              onEdit={() => { setEditingConnection(conn); setModalOpen(true); }}
              onTest={() => handleTest(conn.id)}
              onSetDefault={() => setDefaultConnection(conn.id)}
              onDelete={() => deleteConnection(conn.id)}
            />
          ))}
        </div>
      )}

      {/* Dica para conexões legacy */}
      {connections.some(c => c.id.startsWith('__legacy_')) && (
        <p className="text-xs text-slate-500 px-1">
          * Conexões legadas foram detectadas pelas credenciais globais. Para gerenciar individualmente, adicione uma nova conexão com as mesmas credenciais.
        </p>
      )}

      {/* Modal */}
      {modalOpen && (
        <ConnectionModal
          connection={editingConnection}
          onClose={() => { setModalOpen(false); setEditingConnection(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
