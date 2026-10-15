import { useParams, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Eye, Loader2 } from 'lucide-react'
import { useProposta } from '@/hooks/usePropostas'
import { PropostaDocument } from '@/components/propostas/PropostaDocument'

/** Pré-visualização interna — só para quem está logado conferir a proposta
 * antes de enviar. A página pública (/p/:slug) só existe depois do envio
 * (get_proposta_publica exclui rascunho de propósito, pra não expor link de
 * rascunho pra qualquer um); aqui o acesso é pela sessão autenticada, então
 * funciona em qualquer status, inclusive rascunho. */
export default function PropostaPreview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: proposta, isLoading } = useProposta(id)

  if (isLoading) {
    return (
      <div className="dark min-h-screen flex items-center justify-center" style={{ backgroundColor: '#2A1038' }}>
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    )
  }

  if (!proposta) {
    return (
      <div className="dark min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#2A1038' }}>
        <AlertCircle className="w-12 h-12 text-violet-400" />
        <h1 className="text-2xl font-bold text-slate-100">Proposta não encontrada</h1>
        <button onClick={() => navigate('/propostas')} className="text-sm underline" style={{ color: '#9B5ABE' }}>Voltar</button>
      </div>
    )
  }

  return (
    <div className="dark h-full overflow-y-auto">
      <div className="sticky top-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium" style={{ backgroundColor: '#1a0a24', borderBottom: '1px solid #5D267A' }}>
        <button
          onClick={() => navigate(`/propostas/${id}`)}
          className="flex items-center gap-1.5 text-slate-300 hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>
        <span className="flex items-center gap-1.5" style={{ color: '#9B5ABE' }}>
          <Eye className="w-4 h-4" />
          Pré-visualização — é exatamente isto que o cliente vai ver no link
        </span>
      </div>
      <PropostaDocument proposta={proposta} isPreview />
    </div>
  )
}
