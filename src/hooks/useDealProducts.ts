import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CatalogProduct {
  id: string;
  nome: string;
  preco_mensal: number;
  tipo: string;
  categoria: string;
  descricao: string | null;
  ativo: boolean;
  visivel_pipeline: boolean;
}

export interface DealProduct {
  id: string;
  deal_id: string;
  plano_id: string;
  quantidade: number;
  valor_aplicado: number;
  observacao: string | null;
  plano?: CatalogProduct;
}

// deal_products/planos_propostas.categoria ainda não estão no types.ts gerado.
const db = () => supabase as any;

export function useProductCatalog() {
  return useQuery({
    queryKey: ['product_catalog'],
    queryFn: async () => {
      const { data, error } = await db()
        .from('planos_propostas')
        .select('*')
        .eq('ativo', true)
        .eq('visivel_pipeline', true)
        .order('nome', { ascending: true });
      if (error) throw error;
      return (data ?? []) as CatalogProduct[];
    },
  });
}

export function useDealProducts(dealId: string | undefined) {
  return useQuery({
    queryKey: ['deal_products', dealId],
    queryFn: async () => {
      if (!dealId) return [];
      const { data, error } = await db()
        .from('deal_products')
        .select('*, plano:planos_propostas(*)')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as DealProduct[];
    },
    enabled: !!dealId,
  });
}

export function useAddDealProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealId, plano, quantidade = 1 }: { dealId: string; plano: CatalogProduct; quantidade?: number }) => {
      const { error } = await db().from('deal_products').insert({
        deal_id: dealId,
        plano_id: plano.id,
        quantidade,
        valor_aplicado: plano.preco_mensal,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal_products', variables.dealId] });
      toast.success('Produto adicionado ao negócio');
    },
    onError: (error: any) => {
      if (error?.code === '23505') {
        toast.error('Este produto já está vinculado ao negócio');
      } else {
        toast.error(`Erro ao adicionar produto: ${error.message || error}`);
      }
    },
  });
}

export function useUpdateDealProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, dealId, ...updates }: { id: string; dealId: string; quantidade?: number; valor_aplicado?: number }) => {
      const { error } = await db().from('deal_products').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal_products', variables.dealId] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar produto: ${error.message || error}`);
    },
  });
}

export function useRemoveDealProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; dealId: string }) => {
      const { error } = await db().from('deal_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['deal_products', variables.dealId] });
      toast.success('Produto removido');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover produto: ${error.message || error}`);
    },
  });
}
