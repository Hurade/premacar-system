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
      if (search) query = query.ilike('empresa', `%${search}%`)
      const { data, error } = await query
      if (error) throw error
      return data as Lead[]
    },
  })
}

/** Contacts from CRM for selection in the proposal wizard */
export interface CRMContact {
  id: string
  name: string | null
  phone_number: string
  email: string | null
  oficina: string | null
  notes: string | null
}

export function useCRMContacts(search?: string) {
  return useQuery({
    queryKey: ['contacts', 'for_leads', search],
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('id, name, phone_number, email, oficina, notes')
        .order('name')
      if (search) {
        query = query.or(`name.ilike.%${search}%,oficina.ilike.%${search}%,phone_number.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as CRMContact[]
    },
  })
}

/** Find or create a leads_comerciais entry from a CRM contact */
export function useLeadFromContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (contact: CRMContact): Promise<Lead> => {
      const { data: { user } } = await supabase.auth.getUser()

      // Check if lead already exists for this phone number
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabase as any)
        .from('leads_comerciais')
        .select('*')
        .eq('telefone', contact.phone_number)
        .maybeSingle()

      if (existing) return existing as Lead

      const empresa = contact.oficina || contact.name || contact.phone_number
      const responsavel = contact.name || contact.phone_number

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('leads_comerciais')
        .insert({
          empresa,
          responsavel,
          telefone: contact.phone_number,
          email: contact.email,
          tipo_negocio: 'autocenter',
          origem: 'whatsapp',
          dor_principal: 'cliente_nao_volta',
          observacoes: contact.notes,
          vendedor_id: user?.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads_comerciais'] })
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
