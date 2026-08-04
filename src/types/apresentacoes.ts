import type { AssinaturaVendedor, PlanoTipo } from '@/types/propostas'

export type { AssinaturaVendedor, PlanoTipo }

export type StatusApresentacao = 'rascunho' | 'enviada' | 'visualizada' | 'expirada'

/** Template 'parceiros_comerciais' — indicação, sem preço. */
export type TemplateTipo = 'parceiros_comerciais' | 'oficina_direta'

/** Só relevante para o template 'oficina_direta'. */
export type PublicoAlvo = 'parceiro_comercial' | 'oficina' | 'autocenter'
export type AtuacaoPrincipal = 'oleo' | 'pneus' | 'mecanica_geral' | 'outro'

export const PUBLICO_ALVO_LABELS: Record<PublicoAlvo, string> = {
  parceiro_comercial: 'Parceiro Comercial (vai indicar)',
  oficina: 'Oficina (prospect direto)',
  autocenter: 'Auto Center (prospect direto)',
}

export const ATUACAO_LABELS: Record<AtuacaoPrincipal, string> = {
  oleo: 'Troca de óleo',
  pneus: 'Pneus',
  mecanica_geral: 'Mecânica geral',
  outro: 'Outro',
}

export const ESTRATEGIA_LABELS: Record<PlanoTipo, string> = {
  mensurar: 'Mensurar',
  fidelizar: 'Fidelizar',
  recuperar: 'Recuperar',
}

export interface ApresentacaoTemplate {
  id: string
  tipo: string
  nome: string
  descricao: string | null
  ativo: boolean
  ordem: number
  created_at: string
}

export interface ApresentacaoLead {
  id: string
  empresa: string
  responsavel: string
  telefone: string
  email: string | null
}

export interface Apresentacao {
  id: string
  vendedor_id: string | null
  lead_id: string
  lead?: ApresentacaoLead
  template_id: string | null
  template?: ApresentacaoTemplate
  status: StatusApresentacao
  titulo_personalizado: string | null
  assinatura_vendedor: AssinaturaVendedor | null
  publico_alvo: PublicoAlvo | null
  atuacao_principal: AtuacaoPrincipal | null
  estrategia_inicial: PlanoTipo | null
  tem_erp: boolean | null
  erp_nome: string | null
  validade_dias: number
  validade_ate: string | null
  slug: string
  notas_vendedor: string | null
  enviada_at: string | null
  visualizada_at: string | null
  created_at: string
  updated_at: string
  historico?: ApresentacaoHistorico[]
}

export interface ApresentacaoHistorico {
  id: string
  apresentacao_id: string
  acao: string
  descricao: string | null
  usuario_id: string | null
  created_at: string
}

export interface ApresentacaoMetrics {
  total: number
  rascunho: number
  enviadas: number
  visualizadas: number
  expiradas: number
  taxa_visualizacao: number
}

export const STATUS_LABELS: Record<StatusApresentacao, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  visualizada: 'Visualizada',
  expirada: 'Expirada',
}

export const STATUS_COLORS: Record<StatusApresentacao, string> = {
  rascunho: 'bg-muted/50 text-muted-foreground border-border',
  enviada: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  visualizada: 'bg-green-500/10 text-green-400 border-green-500/20',
  expirada: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}
