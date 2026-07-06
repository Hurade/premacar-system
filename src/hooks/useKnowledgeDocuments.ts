import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface KnowledgeDocument {
  id: string;
  title: string;
  file_name: string | null;
  file_type: string | null;
  storage_path: string | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  error_message: string | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

// knowledge_documents/knowledge_chunks ainda não estão no types.ts gerado
// (tabelas novas) — mesmo padrão de cast já usado em usePropostas.ts.
const db = () => supabase as any;

export function useKnowledgeDocuments() {
  return useQuery({
    queryKey: ['knowledge_documents'],
    queryFn: async () => {
      const { data, error } = await db()
        .from('knowledge_documents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as KnowledgeDocument[];
    },
  });
}

function inferFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (ext === 'csv') return 'csv';
  return 'txt';
}

export function useUploadKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      const fileType = inferFileType(file.name);
      const storagePath = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const { error: uploadError } = await supabase.storage
        .from('knowledge-base')
        .upload(storagePath, file);
      if (uploadError) throw uploadError;

      const { data: doc, error: insertError } = await db()
        .from('knowledge_documents')
        .insert({
          title: title || file.name,
          file_name: file.name,
          file_type: fileType,
          storage_path: storagePath,
          status: 'pending',
        })
        .select()
        .single();
      if (insertError) throw insertError;

      const { error: invokeError } = await supabase.functions.invoke('knowledge-ingest', {
        body: { document_id: doc.id },
      });
      if (invokeError) throw invokeError;

      return doc as KnowledgeDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge_documents'] });
      toast.success('Documento enviado — processando em segundo plano');
    },
    onError: (error: any) => {
      toast.error(`Erro ao enviar documento: ${error.message || error}`);
    },
  });
}

export function useReprocessKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { error } = await supabase.functions.invoke('knowledge-ingest', {
        body: { document_id: documentId },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge_documents'] });
      toast.success('Reprocessamento iniciado');
    },
    onError: (error: any) => {
      toast.error(`Erro ao reprocessar: ${error.message || error}`);
    },
  });
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (doc: KnowledgeDocument) => {
      if (doc.storage_path) {
        await supabase.storage.from('knowledge-base').remove([doc.storage_path]);
      }
      const { error } = await db().from('knowledge_documents').delete().eq('id', doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge_documents'] });
      toast.success('Documento removido');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover documento: ${error.message || error}`);
    },
  });
}
