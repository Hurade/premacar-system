import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import type { Apresentacao, ApresentacaoMetrics, ApresentacaoTemplate, AssinaturaVendedor } from '@/types/apresentacoes'
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

export function useApresentacoes() {
  return useQuery({
    queryKey: ['apresentacoes_comerciais'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('apresentacoes_comerciais')
        .select(`*, lead:leads_comerciais(*), template:apresentacoes_templates(*)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Apresentacao[]
    },
  })
}

export function useApresentacao(id: string | undefined) {
  return useQuery({
    queryKey: ['apresentacoes_comerciais', id],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('apresentacoes_comerciais')
        .select(`
          *,
          lead:leads_comerciais(*),
          template:apresentacoes_templates(*),
          historico:apresentacoes_historico(*)
        `)
        .eq('id', id)
        .order('created_at', { referencedTable: 'apresentacoes_historico', ascending: false })
        .single()
      if (error) throw error
      return data as Apresentacao
    },
    enabled: !!id,
  })
}

export function useApresentacaoBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['apresentacoes_comerciais', 'slug', slug],
    queryFn: async () => {
      // Acesso público via RPC (a tabela não é exposta ao público)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_apresentacao_publica', { p_slug: slug })
      if (error) throw error
      if (!data) throw new Error('Apresentação não encontrada')
      return data as Apresentacao
    },
    enabled: !!slug,
  })
}

/** Atualização de status feita pelo lead na página pública (sem login) — só enviada → visualizada. */
export function useApresentacaoPublicaStatus(slug: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc('atualizar_status_apresentacao_publica', { p_slug: slug })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacoes_comerciais', 'slug', slug] })
    },
  })
}

export function useApresentacaoMetrics(): { data: ApresentacaoMetrics | null; isLoading: boolean } {
  const { data: apresentacoes, isLoading } = useApresentacoes()

  if (!apresentacoes) return { data: null, isLoading }

  const enviadasOuMais = apresentacoes.filter(a => a.status !== 'rascunho').length

  const metrics: ApresentacaoMetrics = {
    total: apresentacoes.length,
    rascunho: apresentacoes.filter(a => a.status === 'rascunho').length,
    enviadas: apresentacoes.filter(a => a.status === 'enviada').length,
    visualizadas: apresentacoes.filter(a => a.status === 'visualizada').length,
    expiradas: apresentacoes.filter(a => a.status === 'expirada').length,
    taxa_visualizacao: enviadasOuMais > 0
      ? Math.round((apresentacoes.filter(a => a.status === 'visualizada').length / enviadasOuMais) * 100)
      : 0,
  }

  return { data: metrics, isLoading }
}

export function useCreateApresentacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      lead_id: string
      empresa: string
      template_id: string | null
      titulo_personalizado: string | null
      assinatura_vendedor: AssinaturaVendedor | null
      validade_dias: number
      publico_alvo?: import('@/types/apresentacoes').PublicoAlvo | null
      atuacao_principal?: import('@/types/apresentacoes').AtuacaoPrincipal | null
      estrategia_inicial?: import('@/types/apresentacoes').PlanoTipo | null
      tem_erp?: boolean | null
      erp_nome?: string | null
    }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const slug = generateSlug(params.empresa)
      const validade = new Date()
      validade.setDate(validade.getDate() + (params.validade_dias || 30))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('apresentacoes_comerciais')
        .insert({
          lead_id: params.lead_id,
          template_id: params.template_id,
          titulo_personalizado: params.titulo_personalizado,
          assinatura_vendedor: params.assinatura_vendedor,
          validade_dias: params.validade_dias,
          publico_alvo: params.publico_alvo ?? null,
          atuacao_principal: params.atuacao_principal ?? null,
          estrategia_inicial: params.estrategia_inicial ?? null,
          tem_erp: params.tem_erp ?? null,
          erp_nome: params.erp_nome ?? null,
          slug,
          status: 'rascunho',
          validade_ate: validade.toISOString().split('T')[0],
          vendedor_id: user?.id,
        })
        .select()
        .single()
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('apresentacoes_historico').insert({
        apresentacao_id: data.id,
        usuario_id: user?.id,
        acao: 'criada',
        descricao: 'Apresentação criada',
      })

      return data as Apresentacao
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacoes_comerciais'] })
      toast.success('Apresentação criada com sucesso!')
    },
    onError: (e) => { console.error(e); toast.error('Erro ao criar apresentação') },
  })
}

export function useUpdateApresentacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<Apresentacao> & { id: string }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('apresentacoes_comerciais')
        .update(fields)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Apresentacao
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['apresentacoes_comerciais'] })
      queryClient.invalidateQueries({ queryKey: ['apresentacoes_comerciais', vars.id] })
    },
  })
}

export function useUpdateApresentacaoStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const now = new Date().toISOString()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: any = { status }
      if (status === 'enviada') updates.enviada_at = now
      if (status === 'visualizada') updates.visualizada_at = now

      // Para 'visualizada': atualiza SOMENTE se o status atual for 'enviada'.
      // Isso evita duplicatas no histórico quando o link é aberto várias vezes.
      if (status === 'visualizada') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: updated } = await (supabase as any)
          .from('apresentacoes_comerciais')
          .update(updates)
          .eq('id', id)
          .eq('status', 'enviada')
          .select()
          .maybeSingle()

        if (!updated) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: current } = await (supabase as any)
            .from('apresentacoes_comerciais')
            .select('*')
            .eq('id', id)
            .single()
          return current as Apresentacao
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('apresentacoes_historico').insert({
          apresentacao_id: id,
          usuario_id: user?.id ?? null,
          acao: 'visualizada',
          descricao: 'Apresentação visualizada pelo lead',
        })
        return updated as Apresentacao
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('apresentacoes_comerciais')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('apresentacoes_historico').insert({
        apresentacao_id: id,
        usuario_id: user?.id,
        acao: status,
        descricao: `Status alterado para "${status}"`,
      })

      return data as Apresentacao
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacoes_comerciais'] })
      toast.success('Status atualizado!')
    },
  })
}

export function useDeleteApresentacao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('apresentacoes_comerciais').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apresentacoes_comerciais'] })
      toast.success('Apresentação removida!')
    },
  })
}

export function useApresentacaoTemplates() {
  return useQuery({
    queryKey: ['apresentacoes_templates'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('apresentacoes_templates')
        .select('*')
        .eq('ativo', true)
        .order('ordem')
      if (error) throw error
      return (data ?? []) as ApresentacaoTemplate[]
    },
  })
}
