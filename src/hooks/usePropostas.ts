import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Proposta, PropostaMetrics, DiagnosticoRespostas } from '@/types/propostas'
import { toast } from 'sonner'

function generateSlug(empresa: string): string {
  const random = Math.random().toString(36).substring(2, 8)
  const base = empresa
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 20)
  return `${base}-${random}`
}

const db = () => supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>
}

export function usePropostas() {
  return useQuery({
    queryKey: ['propostas_comerciais'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('propostas_comerciais')
        .select(`*, lead:leads_comerciais(*), plano:planos_propostas(*)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Proposta[]
    },
  })
}

export function useProposta(id: string | undefined) {
  return useQuery({
    queryKey: ['propostas_comerciais', id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('propostas_comerciais')
        .select(`
          *,
          lead:leads_comerciais(*),
          plano:planos_propostas(*),
          historico:propostas_historico(*)
        `)
        .eq('id', id)
        .order('created_at', { referencedTable: 'propostas_historico', ascending: false })
        .single()
      if (error) throw error
      return data as Proposta
    },
    enabled: !!id,
  })
}

export function usePropostaBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['propostas_comerciais', 'slug', slug],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('propostas_comerciais')
        .select(`*, lead:leads_comerciais(*), plano:planos_propostas(*)`)
        .eq('slug', slug)
        .single()
      if (error) throw error
      return data as Proposta
    },
    enabled: !!slug,
  })
}

export function usePropostaMetrics(): { data: PropostaMetrics | null; isLoading: boolean } {
  const { data: propostas, isLoading } = usePropostas()

  if (!propostas) return { data: null, isLoading }

  const ativas = propostas.filter(p => p.status !== 'rascunho')
  const valorLiquido = (p: Proposta) => p.valor_mensal * (1 - p.desconto_percentual / 100)

  const metrics: PropostaMetrics = {
    total: propostas.length,
    rascunho: propostas.filter(p => p.status === 'rascunho').length,
    enviadas: propostas.filter(p => p.status === 'enviada').length,
    visualizadas: propostas.filter(p => p.status === 'visualizada').length,
    em_negociacao: propostas.filter(p => p.status === 'em_negociacao').length,
    aceitas: propostas.filter(p => p.status === 'aceita').length,
    recusadas: propostas.filter(p => p.status === 'recusada').length,
    expiradas: propostas.filter(p => p.status === 'expirada').length,
    valor_total_negociacao: propostas
      .filter(p => ['enviada', 'visualizada', 'em_negociacao'].includes(p.status))
      .reduce((s, p) => s + valorLiquido(p), 0),
    receita_mensal_prevista: propostas
      .filter(p => p.status === 'aceita')
      .reduce((s, p) => s + valorLiquido(p), 0),
    taxa_conversao: ativas.length > 0
      ? Math.round((propostas.filter(p => p.status === 'aceita').length / ativas.length) * 100)
      : 0,
  }

  return { data: metrics, isLoading }
}

export function useCreateProposta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      lead_id: string
      empresa: string
      plano_id: string | null
      diagnostico: DiagnosticoRespostas | null
      valor_mensal: number
      desconto_percentual: number
      condicao_especial: string | null
      validade_dias: number
      notas_vendedor: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const slug = generateSlug(params.empresa)
      const validade = new Date()
      validade.setDate(validade.getDate() + (params.validade_dias || 15))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('propostas_comerciais')
        .insert({
          lead_id: params.lead_id,
          plano_id: params.plano_id,
          diagnostico: params.diagnostico,
          valor_mensal: params.valor_mensal,
          desconto_percentual: params.desconto_percentual,
          condicao_especial: params.condicao_especial,
          validade_dias: params.validade_dias,
          notas_vendedor: params.notas_vendedor,
          slug,
          status: 'rascunho',
          validade_ate: validade.toISOString().split('T')[0],
          vendedor_id: user?.id,
        })
        .select()
        .single()
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('propostas_historico').insert({
        proposta_id: data.id,
        usuario_id: user?.id,
        acao: 'criada',
        descricao: 'Proposta criada',
      })

      return data as Proposta
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propostas_comerciais'] })
      toast.success('Proposta criada com sucesso!')
    },
    onError: (e) => { console.error(e); toast.error('Erro ao criar proposta') },
  })
}

export function useUpdateProposta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<Proposta> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('propostas_comerciais')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Proposta
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['propostas_comerciais'] })
      queryClient.invalidateQueries({ queryKey: ['propostas_comerciais', vars.id] })
    },
  })
}

export function useUpdatePropostaStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      status,
      motivo_recusa,
    }: { id: string; status: string; motivo_recusa?: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const now = new Date().toISOString()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = { status }
      if (status === 'enviada' && !updates.enviada_at) updates.enviada_at = now
      if (status === 'visualizada') updates.visualizada_at = now
      if (status === 'aceita') updates.aceita_at = now
      if (status === 'recusada') { updates.recusada_at = now; updates.motivo_recusa = motivo_recusa }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('propostas_comerciais')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('propostas_historico').insert({
        proposta_id: id,
        usuario_id: user?.id,
        acao: status,
        descricao: `Status alterado para "${status}"`,
      })

      return data as Proposta
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propostas_comerciais'] })
      toast.success('Status atualizado!')
    },
  })
}

export function useDeleteProposta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('propostas_comerciais').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propostas_comerciais'] })
      toast.success('Proposta removida!')
    },
  })
}

export function usePlanos() {
  return useQuery({
    queryKey: ['planos_propostas'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('planos_propostas')
        .select('*')
        .eq('ativo', true)
        .order('preco_mensal')
      if (error) throw error
      return data ?? []
    },
  })
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _unused = db
