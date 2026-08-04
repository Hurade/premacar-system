import type { AssinaturaVendedor } from '@/types/apresentacoes'

export interface ParceirosComerciaisDeckProps {
  empresa?: string
  responsavel?: string
  tituloPersonalizado?: string | null
  assinaturaVendedor?: AssinaturaVendedor | null
}
