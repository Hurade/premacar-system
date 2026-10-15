import { ParceirosComerciaisDeck } from '@/components/apresentacoes/decks/parceiros-comerciais'
import { OficinaDiretaDeck } from '@/components/apresentacoes/decks/oficina-direta'
import type { Apresentacao } from '@/types/apresentacoes'

/** Corpo visual da apresentação — compartilhado entre a página pública
 * (/apresentacao/:slug, aberta pelo lead) e a pré-visualização interna
 * (vendedor conferindo antes de enviar). */
export function ApresentacaoDocument({ apresentacao }: { apresentacao: Apresentacao }) {
  const lead = apresentacao.lead
  const tipo = apresentacao.template?.tipo

  if (tipo === 'oficina_direta') {
    return (
      <OficinaDiretaDeck
        empresa={lead?.empresa}
        responsavel={lead?.responsavel}
        tituloPersonalizado={apresentacao.titulo_personalizado}
        assinaturaVendedor={apresentacao.assinatura_vendedor}
        atuacaoPrincipal={apresentacao.atuacao_principal}
        estrategiaInicial={apresentacao.estrategia_inicial}
        temErp={apresentacao.tem_erp}
        erpNome={apresentacao.erp_nome}
      />
    )
  }

  return (
    <ParceirosComerciaisDeck
      empresa={lead?.empresa}
      responsavel={lead?.responsavel}
      tituloPersonalizado={apresentacao.titulo_personalizado}
      assinaturaVendedor={apresentacao.assinatura_vendedor}
    />
  )
}
