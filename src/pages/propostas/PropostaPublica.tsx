import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Check, AlertCircle, Loader2, ChevronRight, TrendingUp, Shield, Star, Zap } from 'lucide-react'
import { usePropostaBySlug, useUpdatePropostaStatus } from '@/hooks/usePropostas'
import { PLANOS_PADRAO, formatarMoeda, type PlanoTipo, DOR_LABELS } from '@/types/propostas'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
      <span className="w-1 h-5 rounded-full" style={{ backgroundColor: '#9B5ABE' }} />
      {children}
    </h2>
  )
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm" style={{ color: '#C8C4CE' }}>
      <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#9B5ABE' }} />
      {children}
    </li>
  )
}

export default function PropostaPublica() {
  const { slug } = useParams<{ slug: string }>()
  const { data: proposta, isLoading } = usePropostaBySlug(slug)
  const updateStatus = useUpdatePropostaStatus()
  const [accepted, setAccepted] = useState(false)
  const trackedRef = useRef(false)

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
        <h1 className="text-2xl font-bold text-white">Proposta não encontrada</h1>
        <p style={{ color: '#C8C4CE' }}>O link pode ter expirado ou sido removido.</p>
      </div>
    )
  }

  if (proposta.status === 'expirada') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6" style={{ backgroundColor: '#2A1038' }}>
        <AlertCircle className="w-12 h-12 text-orange-400" />
        <h1 className="text-2xl font-bold text-white">Proposta Expirada</h1>
        <p style={{ color: '#C8C4CE' }}>
          Essa proposta não está mais válida. Entre em contato com seu representante Prema Car.
        </p>
      </div>
    )
  }

  const lead = proposta.lead
  const planoTipo = proposta.plano?.tipo as PlanoTipo | undefined
  const planoInfo = planoTipo ? PLANOS_PADRAO[planoTipo] : null
  const valorLiquido = proposta.valor_mensal * (1 - proposta.desconto_percentual / 100)
  const validade = proposta.validade_ate
    ? new Date(proposta.validade_ate).toLocaleDateString('pt-BR')
    : null

  const diag = proposta.diagnostico
  const problemas: string[] = []
  if (diag) {
    if (!diag.faz_pos_venda) problemas.push('Sem processo de pós-venda estruturado')
    if (!diag.mede_nps) problemas.push('Satisfação dos clientes não mensurada')
    if (diag.base_parada) problemas.push('Base com clientes inativos')
    if (diag.whatsapp_tipo === 'manual' || diag.whatsapp_tipo === 'nenhum')
      problemas.push('WhatsApp sem automação — processo lento e inconsistente')
    if (!diag.tem_equipe_followup) problemas.push('Sem equipe dedicada para acompanhamento')
    if (diag.quer_recuperar) problemas.push('Clientes parados sem estratégia de reativação')
  }

  // Track visualização — executa uma única vez quando a proposta carrega
  useEffect(() => {
    if (proposta && proposta.status === 'enviada' && !trackedRef.current) {
      trackedRef.current = true
      updateStatus.mutate({ id: proposta.id, status: 'visualizada' })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposta?.id, proposta?.status])

  async function handleAccept() {
    if (accepted) return
    await updateStatus.mutateAsync({ id: proposta!.id, status: 'aceita' })
    setAccepted(true)
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: '#2A1038', color: '#FFFFFF' }}>
      {/* Cover */}
      <div
        className="relative px-6 py-16 text-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #3A1750 0%, #5D267A 50%, #2A1038 100%)' }}
      >
        {/* Glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-20 blur-[80px]" style={{ backgroundColor: '#9B5ABE' }} />

        <div className="relative z-10 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-6 text-sm font-medium" style={{ borderColor: '#7B3A9E', color: '#9B5ABE' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            Proposta Comercial
          </div>
          <h1 className="text-4xl font-extrabold text-white mb-3 leading-tight">
            Transforme o pós-venda de
            <br />
            <span style={{ color: '#9B5ABE' }}>{lead?.empresa}</span>
          </h1>
          <p className="text-lg mb-8" style={{ color: '#C8C4CE' }}>
            Preparada especialmente para {lead?.responsavel}
          </p>
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl text-white font-bold text-xl" style={{ backgroundColor: '#5D267A' }}>
            {planoInfo ? (
              <>
                <span>{planoInfo.nome}</span>
                <span style={{ color: '#C8C4CE' }}>—</span>
                <span>{formatarMoeda(valorLiquido)}/mês</span>
              </>
            ) : (
              <span>{formatarMoeda(valorLiquido)}/mês</span>
            )}
          </div>
          {proposta.desconto_percentual > 0 && (
            <p className="mt-2 text-sm" style={{ color: '#9B5ABE' }}>
              Você tem {proposta.desconto_percentual}% de desconto especial aplicado
            </p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-12">
        {/* Diagnóstico */}
        {diag && (
          <section>
            <SectionTitle>Diagnóstico da Sua Operação</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                ['Pós-venda', diag.faz_pos_venda ? '✅ Faz' : '❌ Não faz'],
                ['NPS', diag.mede_nps ? '✅ Mede' : '❌ Não mede'],
                ['Base parada', diag.base_parada ? '❌ Tem' : '✅ Não tem'],
                ['WhatsApp', { nenhum: '❌ Nenhum', manual: '⚠️ Manual', automatizado: '✅ Auto' }[diag.whatsapp_tipo]],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl p-3 text-center border" style={{ backgroundColor: '#3A1750', borderColor: '#5D267A' }}>
                  <p className="text-lg mb-1">{value}</p>
                  <p className="text-xs" style={{ color: '#C8C4CE' }}>{label}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Problemas identificados */}
        {problemas.length > 0 && (
          <section>
            <SectionTitle>Problemas Identificados</SectionTitle>
            <div className="space-y-2">
              {problemas.map(p => (
                <div key={p} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(220, 38, 38, 0.08)', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <p className="text-sm text-red-300">{p}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Solução */}
        {lead?.dor_principal && (
          <section>
            <SectionTitle>Nossa Solução para Você</SectionTitle>
            <div className="p-5 rounded-2xl border" style={{ backgroundColor: '#3A1750', borderColor: '#5D267A' }}>
              <p className="text-sm mb-4" style={{ color: '#C8C4CE' }}>
                Com base na dor <strong className="text-white">{DOR_LABELS[lead.dor_principal]}</strong>,
                a Prema Car vai automatizar e escalar o pós-venda do {lead.empresa} com:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: Zap, title: 'Automação', desc: 'WhatsApp automático para todos os clientes' },
                  { icon: Star, title: 'NPS em Tempo Real', desc: 'Pesquisa de satisfação pós-atendimento' },
                  { icon: TrendingUp, title: 'Reativação', desc: 'Recupere quem parou de vir' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(93, 38, 122, 0.3)' }}>
                    <Icon className="w-5 h-5 mb-2" style={{ color: '#9B5ABE' }} />
                    <p className="font-semibold text-white text-sm mb-1">{title}</p>
                    <p className="text-xs" style={{ color: '#C8C4CE' }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Plano */}
        {planoInfo && (
          <section>
            <SectionTitle>{planoInfo.nome} — O que está incluso</SectionTitle>
            <div className="p-5 rounded-2xl border" style={{ backgroundColor: '#3A1750', borderColor: '#5D267A' }}>
              <p className="text-sm mb-4" style={{ color: '#C8C4CE' }}>{planoInfo.descricao}</p>
              <ul className="space-y-2">
                {planoInfo.recursos.map(r => <CheckItem key={r}>{r}</CheckItem>)}
              </ul>
            </div>
          </section>
        )}

        {/* Investimento */}
        <section>
          <SectionTitle>Investimento</SectionTitle>
          <div className="p-6 rounded-2xl text-center" style={{ background: 'linear-gradient(135deg, #3A1750, #5D267A)', border: '1px solid #7B3A9E' }}>
            <p className="text-sm mb-1" style={{ color: '#C8C4CE' }}>Valor mensal</p>
            {proposta.desconto_percentual > 0 && (
              <p className="text-lg line-through" style={{ color: '#C8C4CE' }}>{formatarMoeda(proposta.valor_mensal)}/mês</p>
            )}
            <p className="text-4xl font-extrabold text-white mb-1">{formatarMoeda(valorLiquido)}</p>
            <p style={{ color: '#C8C4CE' }} className="text-sm">por mês</p>
            {proposta.condicao_especial && (
              <div className="mt-3 px-4 py-2 rounded-xl inline-block" style={{ backgroundColor: 'rgba(155, 90, 190, 0.2)', border: '1px solid rgba(155, 90, 190, 0.4)' }}>
                <p className="text-sm font-medium" style={{ color: '#9B5ABE' }}>🎁 {proposta.condicao_especial}</p>
              </div>
            )}
            {validade && (
              <p className="text-xs mt-4" style={{ color: '#C8C4CE' }}>
                Proposta válida até <strong className="text-white">{validade}</strong>
              </p>
            )}
          </div>
        </section>

        {/* Próximos passos */}
        <section>
          <SectionTitle>Próximos Passos</SectionTitle>
          <div className="space-y-3">
            {[
              { n: 1, title: 'Aceite a proposta', desc: 'Clique no botão abaixo para confirmar' },
              { n: 2, title: 'Onboarding guiado', desc: 'Nossa equipe entra em contato em até 24h' },
              { n: 3, title: 'Configuração em 12min', desc: 'Setup rápido e sem complicação' },
              { n: 4, title: 'Primeiros resultados', desc: 'Veja o retorno já nos primeiros 30 dias' },
            ].map(({ n, title, desc }) => (
              <div key={n} className="flex items-center gap-4 p-4 rounded-xl" style={{ backgroundColor: '#3A1750', border: '1px solid #5D267A' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm" style={{ backgroundColor: '#5D267A', color: '#9B5ABE' }}>
                  {n}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{title}</p>
                  <p className="text-xs" style={{ color: '#C8C4CE' }}>{desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: '#7B3A9E' }} />
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="pb-8">
          {proposta.status === 'aceita' || accepted ? (
            <div className="text-center p-8 rounded-2xl" style={{ backgroundColor: 'rgba(34, 197, 94, 0.08)', border: '2px solid rgba(34, 197, 94, 0.3)' }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 bg-green-500/20">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Proposta Aceita!</h2>
              <p style={{ color: '#C8C4CE' }}>
                Nossa equipe entrará em contato com {lead?.responsavel} em até 24 horas para iniciar o onboarding.
              </p>
              <div className="mt-4 flex items-center gap-2 justify-center">
                <Shield className="w-4 h-4 text-green-400" />
                <p className="text-sm text-green-400 font-medium">Confirmado em {new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={handleAccept}
                disabled={updateStatus.isPending}
                className="group relative px-10 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #5D267A, #9B5ABE)', boxShadow: '0 8px 32px rgba(93, 38, 122, 0.4)' }}
              >
                {updateStatus.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Confirmando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    Aceitar Proposta
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                )}
              </button>
              <p className="text-xs mt-3" style={{ color: '#C8C4CE' }}>
                Ao aceitar, um consultor Prema Car entrará em contato em até 24 horas.
              </p>
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center text-xs pb-8" style={{ color: 'rgba(200, 196, 206, 0.5)' }}>
          <p>Prema Car — Pós-venda inteligente para autocenters</p>
          <p className="mt-1">comercial@premacar.com.br</p>
        </footer>
      </div>
    </div>
  )
}
