import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { usePropostaBySlug, usePropostaPublicaStatus } from '@/hooks/usePropostas'
import { PropostaDocument } from '@/components/propostas/PropostaDocument'

export default function PropostaPublica() {
  const { slug } = useParams<{ slug: string }>()
  const { data: proposta, isLoading } = usePropostaBySlug(slug)
  const updateStatus = usePropostaPublicaStatus(slug)
  const [accepted, setAccepted] = useState(false)
  const trackedRef = useRef(false)

  // DEVE estar antes de qualquer return condicional (Regras dos Hooks)
  useEffect(() => {
    if (proposta?.status === 'enviada' && !trackedRef.current) {
      trackedRef.current = true
      updateStatus.mutate({ status: 'visualizada' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposta?.id, proposta?.status])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#2A1038' }}>
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    )
  }

  if (!proposta) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: '#2A1038' }}>
        <AlertCircle className="w-12 h-12 text-violet-400" />
        <h1 className="text-2xl font-bold text-slate-100">Proposta não encontrada</h1>
        <p style={{ color: '#C8C4CE' }}>O link pode ter expirado ou sido removido.</p>
      </div>
    )
  }

  if (proposta.status === 'expirada') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6" style={{ backgroundColor: '#2A1038' }}>
        <AlertCircle className="w-12 h-12 text-orange-400" />
        <h1 className="text-2xl font-bold text-slate-100">Proposta Expirada</h1>
        <p style={{ color: '#C8C4CE' }}>
          Essa proposta não está mais válida. Entre em contato com seu representante Prema Car.
        </p>
      </div>
    )
  }

  async function handleAccept() {
    if (accepted) return
    await updateStatus.mutateAsync({ status: 'aceita' })
    setAccepted(true)
  }

  return (
    <PropostaDocument
      proposta={proposta}
      accepted={accepted}
      isPending={updateStatus.isPending}
      onAccept={handleAccept}
    />
  )
}
