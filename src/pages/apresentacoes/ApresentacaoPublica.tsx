import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useApresentacaoBySlug, useApresentacaoPublicaStatus } from '@/hooks/useApresentacoes'
import { ParceirosComerciaisDeck } from '@/components/apresentacoes/decks/parceiros-comerciais'
import { OficinaDiretaDeck } from '@/components/apresentacoes/decks/oficina-direta'

export default function ApresentacaoPublica() {
  const { slug } = useParams<{ slug: string }>()
  const { data: apresentacao, isLoading } = useApresentacaoBySlug(slug)
  const updateStatus = useApresentacaoPublicaStatus(slug)
  const trackedRef = useRef(false)

  // DEVE estar antes de qualquer return condicional (Regras dos Hooks)
  useEffect(() => {
    if (apresentacao?.status === 'enviada' && !trackedRef.current) {
      trackedRef.current = true
      updateStatus.mutate()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apresentacao?.id, apresentacao?.status])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ededed' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#612c7d' }} />
      </div>
    )
  }

  if (!apresentacao) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6" style={{ backgroundColor: '#ededed' }}>
        <AlertCircle className="w-12 h-12" style={{ color: '#612c7d' }} />
        <h1 className="text-2xl font-bold" style={{ color: '#3a3a3a' }}>Apresentação não encontrada</h1>
        <p style={{ color: '#7d7d7d' }}>O link pode ter expirado ou sido removido.</p>
      </div>
    )
  }

  if (apresentacao.status === 'expirada') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6" style={{ backgroundColor: '#ededed' }}>
        <AlertCircle className="w-12 h-12" style={{ color: '#da7c65' }} />
        <h1 className="text-2xl font-bold" style={{ color: '#3a3a3a' }}>Apresentação Expirada</h1>
        <p style={{ color: '#7d7d7d' }}>
          Esse link não está mais válido. Entre em contato com seu representante Prema para receber um novo.
        </p>
      </div>
    )
  }

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
