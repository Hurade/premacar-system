export type TipoNegocio = 'oficina' | 'autocenter' | 'rede' | 'franquia' | 'outro'
export type OrigemLead = 'feira' | 'indicacao' | 'instagram' | 'whatsapp' | 'prospeccao' | 'site' | 'lista' | 'outro'
export type DorPrincipal =
  | 'cliente_nao_volta'
  | 'falta_pos_venda'
  | 'reclamacoes'
  | 'baixa_fidelizacao'
  | 'falta_controle'
  | 'automatizar_whatsapp'
  | 'outro'
export type StatusProposta =
  | 'rascunho'
  | 'enviada'
  | 'visualizada'
  | 'em_negociacao'
  | 'revisao'
  | 'aceita'
  | 'recusada'
  | 'expirada'
export type PlanoTipo = 'mensurar' | 'fidelizar' | 'recuperar'

export interface Lead {
  id: string
  empresa: string
  responsavel: string
  telefone: string
  email: string | null
  cidade: string | null
  estado: string | null
  tipo_negocio: TipoNegocio
  clientes_mes: number | null
  clientes_base: number | null
  erp_utilizado: string | null
  origem: OrigemLead
  dor_principal: DorPrincipal
  observacoes: string | null
  vendedor_id: string | null
  created_at: string
  updated_at: string
}

export interface DiagnosticoRespostas {
  faz_pos_venda: boolean
  como_lembra_revisao: string
  mede_nps: boolean
  base_parada: boolean
  whatsapp_tipo: 'manual' | 'automatizado' | 'nenhum'
  quer_recuperar: boolean
  tem_equipe_followup: boolean
  objetivo_principal: 'satisfacao' | 'fidelizar' | 'recuperar'
}

export interface Plano {
  id: string
  tipo: PlanoTipo
  nome: string
  preco_mensal: number
  recursos: string[]
  descricao: string
  ativo: boolean
}

export interface Proposta {
  id: string
  lead_id: string
  lead?: Lead
  plano_id: string | null
  plano?: Plano
  status: StatusProposta
  diagnostico: DiagnosticoRespostas | null
  valor_mensal: number
  desconto_percentual: number
  condicao_especial: string | null
  validade_dias: number
  validade_ate: string | null
  slug: string
  notas_vendedor: string | null
  motivo_recusa: string | null
  vendedor_id: string | null
  enviada_at: string | null
  visualizada_at: string | null
  aceita_at: string | null
  recusada_at: string | null
  created_at: string
  updated_at: string
  historico?: PropostaHistorico[]
}

export interface PropostaHistorico {
  id: string
  proposta_id: string
  acao: string
  descricao: string | null
  usuario_id: string | null
  created_at: string
}

export interface PropostaMetrics {
  total: number
  rascunho: number
  enviadas: number
  visualizadas: number
  em_negociacao: number
  aceitas: number
  recusadas: number
  expiradas: number
  valor_total_negociacao: number
  receita_mensal_prevista: number
  taxa_conversao: number
}

export const PLANOS_PADRAO: Record<PlanoTipo, { nome: string; preco: number; recursos: string[]; descricao: string; cor: string }> = {
  mensurar: {
    nome: 'Plano Mensurar',
    preco: 299,
    cor: '#5D267A',
    descricao: 'Ideal para começar medindo a satisfação dos clientes e entender os pontos de melhoria da operação.',
    recursos: [
      'Pesquisa de satisfação automática',
      'NPS por WhatsApp',
      'Dashboard de métricas',
      'Relatórios mensais',
      'Suporte por e-mail',
    ],
  },
  fidelizar: {
    nome: 'Plano Fidelizar',
    preco: 497,
    cor: '#7B3A9E',
    descricao: 'Para autocenters que querem aumentar a retenção e fazer o cliente voltar sempre.',
    recursos: [
      'Tudo do Plano Mensurar',
      'Lembretes automáticos de revisão',
      'Campanhas de fidelização',
      'WhatsApp automatizado',
      'Segmentação de clientes',
      'Suporte prioritário',
    ],
  },
  recuperar: {
    nome: 'Plano Recuperar',
    preco: 997,
    cor: '#9B5ABE',
    descricao: 'Para recuperar clientes parados e reativar a base completa com automação inteligente.',
    recursos: [
      'Tudo do Plano Fidelizar',
      'Recuperação de clientes inativos',
      'Integração com ERP',
      'Onboarding dedicado',
    ],
  },
}

export const STATUS_LABELS: Record<StatusProposta, string> = {
  rascunho: 'Rascunho',
  enviada: 'Enviada',
  visualizada: 'Visualizada',
  em_negociacao: 'Em Negociação',
  revisao: 'Revisão Solicitada',
  aceita: 'Aceita',
  recusada: 'Recusada',
  expirada: 'Expirada',
}

export const STATUS_COLORS: Record<StatusProposta, string> = {
  rascunho: 'bg-muted/50 text-muted-foreground border-border',
  enviada: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  visualizada: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  em_negociacao: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  revisao: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  aceita: 'bg-green-500/10 text-green-400 border-green-500/20',
  recusada: 'bg-red-500/10 text-red-400 border-red-500/20',
  expirada: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

export const TIPO_NEGOCIO_LABELS: Record<TipoNegocio, string> = {
  oficina: 'Oficina',
  autocenter: 'Autocenter',
  rede: 'Rede de Autocenters',
  franquia: 'Franquia',
  outro: 'Outro',
}

export const ORIGEM_LABELS: Record<OrigemLead, string> = {
  feira: 'Feira',
  indicacao: 'Indicação',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
  prospeccao: 'Prospecção Ativa',
  site: 'Site',
  lista: 'Lista',
  outro: 'Outro',
}

export const DOR_LABELS: Record<DorPrincipal, string> = {
  cliente_nao_volta: 'Cliente não volta',
  falta_pos_venda: 'Falta de pós-venda',
  reclamacoes: 'Reclamações frequentes',
  baixa_fidelizacao: 'Baixa fidelização',
  falta_controle: 'Falta de controle',
  automatizar_whatsapp: 'Quer automatizar WhatsApp',
  outro: 'Outro',
}

export function recomendarPlano(d: DiagnosticoRespostas): PlanoTipo {
  const score = { mensurar: 0, fidelizar: 0, recuperar: 0 }

  if (d.objetivo_principal === 'satisfacao') score.mensurar += 3
  if (d.objetivo_principal === 'fidelizar') score.fidelizar += 3
  if (d.objetivo_principal === 'recuperar') score.recuperar += 3
  if (d.base_parada) score.recuperar += 2
  if (d.quer_recuperar) score.recuperar += 2
  if (!d.faz_pos_venda) score.fidelizar += 1
  if (!d.mede_nps) score.mensurar += 1
  if (d.whatsapp_tipo === 'manual') score.fidelizar += 1
  if (d.whatsapp_tipo === 'nenhum') score.recuperar += 1
  if (!d.tem_equipe_followup) score.recuperar += 1

  if (score.recuperar >= score.fidelizar && score.recuperar >= score.mensurar) return 'recuperar'
  if (score.fidelizar >= score.mensurar) return 'fidelizar'
  return 'mensurar'
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}
