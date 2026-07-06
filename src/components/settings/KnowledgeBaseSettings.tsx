import React, { useEffect, useRef, useState } from 'react';
import { Upload, FileText, RefreshCw, Trash2, Loader2, CheckCircle2, XCircle, Clock, Database } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '../Button';
import {
  useKnowledgeDocuments,
  useUploadKnowledgeDocument,
  useReprocessKnowledgeDocument,
  useDeleteKnowledgeDocument,
  type KnowledgeDocument,
} from '@/hooks/useKnowledgeDocuments';

const STATUS_LABEL: Record<KnowledgeDocument['status'], { label: string; icon: React.ReactNode; className: string }> = {
  pending: { label: 'Pendente', icon: <Clock className="w-3.5 h-3.5" />, className: 'text-slate-400 bg-slate-800' },
  processing: { label: 'Processando', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, className: 'text-cyan-400 bg-cyan-500/10' },
  ready: { label: 'Pronto', icon: <CheckCircle2 className="w-3.5 h-3.5" />, className: 'text-emerald-400 bg-emerald-500/10' },
  error: { label: 'Erro', icon: <XCircle className="w-3.5 h-3.5" />, className: 'text-red-400 bg-red-500/10' },
};

const KnowledgeBaseSettings: React.FC = () => {
  const { data: documents, isLoading } = useKnowledgeDocuments();
  const uploadMutation = useUploadKnowledgeDocument();
  const reprocessMutation = useReprocessKnowledgeDocument();
  const deleteMutation = useDeleteKnowledgeDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ragSettingId, setRagSettingId] = useState<string | null>(null);
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragLoading, setRagLoading] = useState(true);
  const [ragSaving, setRagSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await (supabase as any)
        .from('nina_settings')
        .select('id, rag_enabled')
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setRagSettingId(data.id);
        setRagEnabled(!!data.rag_enabled);
      }
      setRagLoading(false);
    })();
  }, []);

  const toggleRag = async () => {
    if (!ragSettingId) {
      toast.error('Nenhuma configuração da IA encontrada — configure o agente primeiro em "Agente"');
      return;
    }
    setRagSaving(true);
    const next = !ragEnabled;
    const { error } = await (supabase as any)
      .from('nina_settings')
      .update({ rag_enabled: next })
      .eq('id', ragSettingId);
    setRagSaving(false);
    if (error) {
      toast.error('Erro ao atualizar configuração');
      return;
    }
    setRagEnabled(next);
    toast.success(next ? 'Base de conhecimento ativada para a IA' : 'Base de conhecimento desativada para a IA');
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedExt = ['pdf', 'xlsx', 'xls', 'csv', 'txt'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExt.includes(ext)) {
      toast.error('Formato não suportado. Use PDF, XLSX, CSV ou TXT.');
      e.target.value = '';
      return;
    }

    await uploadMutation.mutateAsync({ file, title: file.name });
    e.target.value = '';
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-cyan-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Usar base de conhecimento nas respostas da IA</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Quando ativado, a IA consulta os documentos abaixo antes de responder e usa o conteúdo relevante como contexto extra.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleRag}
          disabled={ragLoading || ragSaving}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            ragEnabled ? 'bg-cyan-500' : 'bg-slate-700'
          } disabled:opacity-50`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              ragEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">Documentos</h3>
            <p className="text-xs text-slate-500 mt-1">PDFs, planilhas (XLSX/CSV) ou texto — catálogos, FAQs, tabelas de planos.</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv,.txt"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button
            variant="primary"
            className="gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
          >
            {uploadMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Enviar documento
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !documents?.length ? (
          <div className="border border-dashed border-slate-800 rounded-xl py-12 text-center text-slate-500 text-sm">
            Nenhum documento enviado ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => {
              const status = STATUS_LABEL[doc.status];
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-4 bg-slate-900/50 border border-slate-800 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-200 truncate">{doc.title}</p>
                      <p className="text-xs text-slate-500">
                        {doc.chunk_count > 0 ? `${doc.chunk_count} trechos indexados` : 'Sem trechos indexados'}
                        {doc.status === 'error' && doc.error_message ? ` — ${doc.error_message}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.className}`}>
                      {status.icon}
                      {status.label}
                    </span>
                    <button
                      type="button"
                      title="Reprocessar"
                      onClick={() => reprocessMutation.mutate(doc.id)}
                      disabled={reprocessMutation.isPending}
                      className="p-1.5 rounded-md text-slate-500 hover:text-cyan-400 hover:bg-slate-800 transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Excluir"
                      onClick={() => deleteMutation.mutate(doc)}
                      disabled={deleteMutation.isPending}
                      className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBaseSettings;
