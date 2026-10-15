import { useParams, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Eye, Loader2 } from 'lucide-react'
import { useApresentacao } from '@/hooks/useApresentacoes'
import { ApresentacaoDocument } from '@/components/apresentacoes/ApresentacaoDocument'

/** Pré-visualização interna — só para quem está logado conferir a
 * apresentação antes de enviar. A página pública (/apresentacao/:slug) só
 * existe depois do envio (get_apresentacao_publica exclui rascunho de
 * propósito); aqui o acesso é pela sessão autenticada, então funciona em
 * qualquer status, inclusive rascunho. */
export default function ApresentacaoPreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: apresentacao, isLoading } = useApresentacao(id)

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
        <button onClick={() => navigate('/apresentacoes')} className="text-sm underline" style={{ color: '#612c7d' }}>Voltar</button>
      </div>
    )
  }

  return (
    <div>
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium bg-white border-b" style={{ borderColor: '#612c7d33' }}>
        <button
          onClick={() => navigate(`/apresentacoes/${id}`)}
          className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
          style={{ color: '#3a3a3a' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <span className="flex items-center gap-1.5" style={{ color: '#612c7d' }}>
          <Eye className="w-4 h-4" />
          Pré-visualização — é exatamente isto que o lead vai ver no link
        </span>
      </div>
      <ApresentacaoDocument apresentacao={apresentacao} />
    </div>
  )
}
