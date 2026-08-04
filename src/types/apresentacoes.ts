import type { AssinaturaVendedor } from '@/types/propostas'

export type { AssinaturaVendedor }

export type StatusApresentacao = 'rascunho' | 'enviada' | 'visualizada' | 'expirada'

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
