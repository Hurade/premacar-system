import type { AssinaturaVendedor, AtuacaoPrincipal, PlanoTipo } from '@/types/apresentacoes'

export interface OficinaDiretaDeckProps {
  empresa?: string
  responsavel?: string
  tituloPersonalizado?: string | null
  assinaturaVendedor?: AssinaturaVendedor | null
  atuacaoPrincipal?: AtuacaoPrincipal | null
  estrategiaInicial?: PlanoTipo | null
  temErp?: boolean | null
  erpNome?: string | null
}
