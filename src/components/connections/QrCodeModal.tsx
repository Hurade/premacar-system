import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle } from 'lucide-react';

interface QrCodeModalProps {
  connectionId: string;
  connectionName: string;
  pollConnectionStatus: (id: string) => Promise<{ is_connected: boolean; qr_code: string | null }>;
  getQrCode: (id: string) => Promise<{ base64: string | null; already_connected?: boolean; error?: string }>;
  onClose: () => void;
}

export function QrCodeModal({
  connectionId,
  connectionName,
  pollConnectionStatus,
  getQrCode,
  onClose,
}: QrCodeModalProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  const stableOnClose = useCallback(onClose, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;

    // Busca ativa de um QR novo na Evolution API — o QR do WhatsApp expira
    // em ~30-60s. Sem isso a tela só mostrava o que já estava salvo no
    // banco desde a criação da conexão, então quem abrisse "Conectar"
    // depois de um tempo sempre via um código já expirado.
    const refreshQr = async () => {
      const result = await getQrCode(connectionId);
      if (!active) return;
      if (result.already_connected) {
        setConnected(true);
        active = false;
        setTimeout(() => stableOnClose(), 1500);
        return;
      }
      if (result.base64) setQrCode(result.base64);
    };

    // Detecção rápida de conexão via leitura passiva do banco (o webhook
    // da Evolution marca is_connected assim que o celular escaneia).
    const checkConnected = async () => {
      const result = await pollConnectionStatus(connectionId);
      if (!active) return;
      if (result.is_connected) {
        setConnected(true);
        active = false;
        setTimeout(() => stableOnClose(), 1500);
      }
    };

    refreshQr();
    const qrInterval = setInterval(refreshQr, 25000);
    const statusInterval = setInterval(checkConnected, 3000);
    return () => {
      active = false;
      clearInterval(qrInterval);
      clearInterval(statusInterval);
    };
  }, [connectionId, getQrCode, pollConnectionStatus, stableOnClose]);

  const normalizedQr = qrCode
    ? qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`
    : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Conectar {connectionName}</DialogTitle>
          <DialogDescription className="text-slate-400">
            {connected ? 'WhatsApp conectado!' : 'Aguardando escaneamento do QR Code...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-5 py-4">
          {connected ? (
            <>
              <CheckCircle className="w-16 h-16 text-green-400" />
              <p className="text-white font-semibold text-lg">Conectado com sucesso!</p>
            </>
          ) : normalizedQr ? (
            <img
              src={normalizedQr}
              alt="QR Code WhatsApp"
              className="w-64 h-64 rounded-xl border border-slate-700 bg-white p-2"
            />
          ) : (
            <div className="w-64 h-64 flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm text-slate-400">Gerando QR Code...</p>
            </div>
          )}

          {!connected && (
            <p className="text-xs text-slate-400 text-center max-w-[260px] leading-relaxed">
              Abra o WhatsApp → <strong className="text-slate-300">Aparelhos conectados</strong> → Conectar aparelho e aponte a câmera
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
