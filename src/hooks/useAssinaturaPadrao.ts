import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { AssinaturaVendedor } from '@/types/propostas'
import { toast } from 'sonner'

/** Assinatura padrão do vendedor (profiles.assinatura_padrao) — salva uma vez
 * e é reaproveitada em toda Proposta/Apresentação nova, em vez de redigitar
 * nome/cargo/telefone/email toda vez. */
export function useAssinaturaPadrao() {
  return useQuery({
    queryKey: ['assinatura_padrao'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('assinatura_padrao')
        .eq('user_id', user.id)
        .maybeSingle()
      if (error) throw error
      return (data?.assinatura_padrao as AssinaturaVendedor | null) ?? null
    },
  })
}

export function useSaveAssinaturaPadrao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (assinatura: AssinaturaVendedor) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Não autenticado')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('profiles')
        .update({ assinatura_padrao: assinatura })
        .eq('user_id', user.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assinatura_padrao'] })
      toast.success('Assinatura salva como padrão!')
    },
    onError: () => toast.error('Erro ao salvar assinatura padrão'),
  })
}
