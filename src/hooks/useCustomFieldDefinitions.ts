import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type CustomFieldType = 'texto' | 'numero' | 'data' | 'select';

export interface CustomFieldDefinition {
  id: string;
  nome: string;
  chave: string;
  tipo: CustomFieldType;
  opcoes: string[];
  obrigatorio: boolean;
  ordem: number;
  ativo: boolean;
}

// custom_field_definitions ainda não está no types.ts gerado (tabela nova).
const db = () => supabase as any;

function slugify(nome: string): string {
  return nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function useCustomFieldDefinitions(onlyActive = false) {
  return useQuery({
    queryKey: ['custom_field_definitions', onlyActive],
    queryFn: async () => {
      let query = db().from('custom_field_definitions').select('*').order('ordem', { ascending: true });
      if (onlyActive) query = query.eq('ativo', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CustomFieldDefinition[];
    },
  });
}

export function useCreateCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { nome: string; tipo: CustomFieldType; opcoes?: string[]; obrigatorio?: boolean }) => {
      const chave = slugify(input.nome);
      const { error } = await db().from('custom_field_definitions').insert({
        nome: input.nome,
        chave,
        tipo: input.tipo,
        opcoes: input.opcoes || [],
        obrigatorio: input.obrigatorio || false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_field_definitions'] });
      toast.success('Campo personalizado criado');
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast.error('Já existe um campo com esse nome');
      } else {
        toast.error(`Erro ao criar campo: ${error.message || error}`);
      }
    },
  });
}

export function useUpdateCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CustomFieldDefinition> & { id: string }) => {
      const { error } = await db().from('custom_field_definitions').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_field_definitions'] });
      toast.success('Campo atualizado');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar campo: ${error.message || error}`);
    },
  });
}

export function useDeleteCustomFieldDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('custom_field_definitions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom_field_definitions'] });
      toast.success('Campo removido');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover campo: ${error.message || error}`);
    },
  });
}
