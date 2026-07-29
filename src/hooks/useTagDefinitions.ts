import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { TagDefinition } from '@/types';

const TAG_DEFINITIONS_KEY = ['tag_definitions'];

function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Fonte única de tag_definitions via react-query: antes, cada tela (Chat,
// Contatos, Configurações) mantinha sua própria cópia em useState — criar
// ou editar uma tag num lugar não atualizava as outras telas sem F5.
export function useTagDefinitions(onlyActive = true) {
  return useQuery({
    queryKey: [...TAG_DEFINITIONS_KEY, onlyActive],
    queryFn: async () => {
      let query = supabase.from('tag_definitions').select('*').order('category', { ascending: true });
      if (onlyActive) query = query.eq('is_active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TagDefinition[];
    },
  });
}

export function useCreateTagDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { label: string; color: string; category: string }) => {
      const key = slugify(input.label);
      const { data, error } = await supabase
        .from('tag_definitions')
        .insert({ key, label: input.label, color: input.color, category: input.category, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data as TagDefinition;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_DEFINITIONS_KEY });
      toast.success('Tag criada com sucesso');
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast.error('Já existe uma tag com esse nome');
      } else {
        toast.error(`Erro ao criar tag: ${error.message || error}`);
      }
    },
  });
}

export function useUpdateTagDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TagDefinition> & { id: string }) => {
      const { error } = await supabase.from('tag_definitions').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_DEFINITIONS_KEY });
      toast.success('Tag atualizada');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar tag: ${error.message || error}`);
    },
  });
}

export function useDeleteTagDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tag_definitions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TAG_DEFINITIONS_KEY });
      toast.success('Tag removida');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover tag: ${error.message || error}`);
    },
  });
}
