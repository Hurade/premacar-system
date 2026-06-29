import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Lead } from '@/types/propostas'
import { toast } from 'sonner'

export function useLeads(search?: string) {
  return useQuery({
    queryKey: ['leads_comerciais', search],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from('leads_comerciais')
        .select('*')
        .order('created_at', { ascending: false })

      if (search) {
        query = query.ilike('empresa', `%${search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data as Lead[]
    },
  })
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: ['leads_comerciais', id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('leads_comerciais')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Lead
    },
    enabled: !!id,
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('leads_comerciais')
        .insert({ ...lead, vendedor_id: lead.vendedor_id ?? user?.id })
        .select()
        .single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads_comerciais'] })
      toast.success('Lead cadastrado com sucesso!')
    },
    onError: () => toast.error('Erro ao cadastrar lead'),
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...lead }: Partial<Lead> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('leads_comerciais')
        .update(lead)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads_comerciais'] })
      toast.success('Lead atualizado!')
    },
    onError: () => toast.error('Erro ao atualizar lead'),
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('leads_comerciais').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads_comerciais'] })
      toast.success('Lead removido!')
    },
    onError: () => toast.error('Erro ao remover lead'),
  })
}
