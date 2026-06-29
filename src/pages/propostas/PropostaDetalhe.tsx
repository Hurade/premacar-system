import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Send, Eye, Check, X, Clock, Copy, ExternalLink,
  MessageCircle, FileText, TrendingUp, AlertCircle, Pencil, Trash2, History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProposta, useUpdatePropostaStatus, useDeleteProposta, useUpdateProposta } from '@/hooks/usePropostas'
import { StatusBadge } from '@/components/propostas/StatusBadge'
import { FollowUpModal } from '@/components/propostas/FollowUpModal'
import { PLANOS_PADRAO, DOR_LABELS, formatarMoeda, STATUS_LABELS, type StatusProposta } from '@/types/propostas'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const STATUS_FLOW: StatusProposta[] = ['rascunho', 'enviada', 'visualizada', 'em_negociacao', 'revisao', 'aceita', 'recusada', 'expirada']

function InfoRow({ label, value, mono }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn('text-sm text-foreground', mono && 'font-mono')}>{value}</p>
    </div>
  )
}

function TimelineItem({ acao, descricao, data }: { acao: string; descricao: string | null; data: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
        <div className="flex-1 w-px bg-border/40 mt-1" />
      </div>
      <div className="pb-4 min-w-0">
        <p className="text-xs font-medium text-foreground capitalize">{STATUS_LABELS[acao as StatusProposta] ?? acao}</p>
        {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </div>
    </div>
  )
}

export default function PropostaDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: proposta, isLoading } = useProposta(id)
  const updateStatus = useUpdatePropostaStatus()
  const updateProposta = useUpdateProposta()
  const deleteProposta = useDeleteProposta()

  const [showFollowUp, setShowFollowUp] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [newStatus, setNewStatus] = useState<StatusProposta>('enviada')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!proposta) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Proposta não encontrada</p>
        <Button variant="outline" onClick={() => navigate('/propostas')}>Voltar</Button>
      </div>
    )
  }

  const lead = proposta.lead
  const planoInfo = proposta.plano?.tipo ? PLANOS_PADRAO[proposta.plano.tipo] : null
  const valorLiquido = proposta.valor_mensal * (1 - proposta.desconto_percentual / 100)
  const publicLink = `${window.location.origin}/p/${proposta.slug}`

  function copyLink() {
    navigator.clipboard.writeText(publicLink)
    toast.success('Link copiado!')
  }

  async function handleStatusChange() {
    await updateStatus.mutateAsync({
      id: proposta!.id,
      status: newStatus,
      motivo_recusa: newStatus === 'recusada' ? motivoRecusa : undefined,
    })
    setShowStatusModal(false)
  }

  async function handleDelete() {
    await deleteProposta.mutateAsync(proposta!.id)
    navigate('/propostas')
  }

  async function handleSaveNotes() {
    await updateProposta.mutateAsync({ id: proposta!.id, notas_vendedor: notes })
    setEditingNotes(false)
    toast.success('Notas salvas!')
  }

  const diag = proposta.diagnostico

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/propostas')} className="p-2 rounded-xl hover:bg-muted/50">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{lead?.empresa}</h1>
                <StatusBadge status={proposta.status} />
              </div>
              <p className="text-sm text-muted-foreground">{lead?.responsavel} — {lead?.telefone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" />
              Copiar Link
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(publicLink, '_blank')} className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" />
              Ver Proposta
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowFollowUp(true) }} className="gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" />
              Follow-up
            </Button>
            <Button
              size="sm"
              onClick={() => { setNewStatus('enviada'); setShowStatusModal(true) }}
              className="gap-1.5 bg-primary hover:bg-primary/90 text-white"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Atualizar Status
            </Button>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Proposta info */}
            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
                <FileText className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Detalhes da Proposta</h2>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Plano</p>
                  {planoInfo && (
                    <span
                      className="text-xs font-bold px-2.5 py-1 rounded-lg text-white inline-block"
                      style={{ backgroundColor: planoInfo.cor }}
                    >
                      {proposta.plano?.nome ?? planoInfo.nome}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Investimento</p>
                  <div>
                    <p className="text-lg font-bold text-foreground">
                      {formatarMoeda(valorLiquido)}
                      <span className="text-xs font-normal text-muted-foreground">/mês</span>
                    </p>
                    {proposta.desconto_percentual > 0 && (
                      <p className="text-xs text-green-400">-{proposta.desconto_percentual}% de desconto</p>
                    )}
                  </div>
                </div>
                <InfoRow label="Condição Especial" value={proposta.condicao_especial} />
                <InfoRow
                  label="Validade"
                  value={proposta.validade_ate
                    ? new Date(proposta.validade_ate).toLocaleDateString('pt-BR')
                    : `${proposta.validade_dias} dias`}
                />
                <InfoRow label="Criada em" value={new Date(proposta.created_at).toLocaleDateString('pt-BR')} />
                {proposta.enviada_at && <InfoRow label="Enviada em" value={new Date(proposta.enviada_at).toLocaleDateString('pt-BR')} />}
                {proposta.visualizada_at && <InfoRow label="Visualizada em" value={new Date(proposta.visualizada_at).toLocaleDateString('pt-BR')} />}
                {proposta.aceita_at && <InfoRow label="Aceita em" value={new Date(proposta.aceita_at).toLocaleDateString('pt-BR')} />}
                {proposta.motivo_recusa && <InfoRow label="Motivo da Recusa" value={proposta.motivo_recusa} />}
              </div>

              {planoInfo && (
                <div className="mt-4 pt-3 border-t border-border/40">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Recursos Inclusos</p>
                  <ul className="grid grid-cols-2 gap-1">
                    {planoInfo.recursos.map(r => (
                      <li key={r} className="flex items-start gap-1.5 text-xs text-foreground">
                        <Check className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Diagnóstico */}
            {diag && (
              <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
                  <Check className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Diagnóstico da Operação</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Faz pós-venda?', diag.faz_pos_venda ? 'Sim' : 'Não'],
                    ['Mede NPS?', diag.mede_nps ? 'Sim' : 'Não'],
                    ['Base parada?', diag.base_parada ? 'Sim' : 'Não'],
                    ['Quer recuperar inativos?', diag.quer_recuperar ? 'Sim' : 'Não'],
                    ['WhatsApp', { nenhum: 'Nenhum', manual: 'Manual', automatizado: 'Automatizado' }[diag.whatsapp_tipo]],
                    ['Equipe para follow-up?', diag.tem_equipe_followup ? 'Sim' : 'Não'],
                    ['Lembra o cliente?', diag.como_lembra_revisao === 'nada' ? 'Não faz' : diag.como_lembra_revisao],
                    ['Objetivo principal', { satisfacao: 'Medir Satisfação', fidelizar: 'Fidelizar', recuperar: 'Recuperar' }[diag.objetivo_principal]],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium text-foreground capitalize">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lead info */}
            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
                <Eye className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Dados do Lead</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="Empresa" value={lead?.empresa} />
                <InfoRow label="Responsável" value={lead?.responsavel} />
                <InfoRow label="Telefone" value={lead?.telefone} />
                <InfoRow label="E-mail" value={lead?.email} />
                <InfoRow label="Cidade/Estado" value={lead?.cidade ? `${lead.cidade}${lead.estado ? ` — ${lead.estado}` : ''}` : null} />
                <InfoRow label="ERP" value={lead?.erp_utilizado} />
                <InfoRow label="Clientes/mês" value={lead?.clientes_mes} />
                <InfoRow label="Base total" value={lead?.clientes_base} />
                {lead?.dor_principal && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Dor Principal</p>
                    <p className="text-sm text-foreground">{DOR_LABELS[lead.dor_principal]}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
            {/* Quick actions */}
            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ações Rápidas</p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => { setNewStatus('enviada'); setShowStatusModal(true) }}
                >
                  <Send className="w-4 h-4 text-blue-400" />
                  Marcar como Enviada
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => { setNewStatus('em_negociacao'); setShowStatusModal(true) }}
                >
                  <TrendingUp className="w-4 h-4 text-violet-400" />
                  Em Negociação
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => { setNewStatus('aceita'); setShowStatusModal(true) }}
                >
                  <Check className="w-4 h-4 text-green-400" />
                  Marcar como Aceita
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 hover:border-red-400/30"
                  onClick={() => { setNewStatus('recusada'); setShowStatusModal(true) }}
                >
                  <X className="w-4 h-4 text-red-400" />
                  Marcar como Recusada
                </Button>
                <hr className="border-border/40" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-red-400 hover:text-red-400 hover:bg-red-500/10"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Proposta
                </Button>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas Internas</p>
                <button onClick={() => { setNotes(proposta.notas_vendedor ?? ''); setEditingNotes(true) }} className="text-muted-foreground hover:text-primary">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="bg-muted/20 border-border/40 resize-none text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveNotes} className="flex-1 bg-primary/80 hover:bg-primary text-white text-xs">Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingNotes(false)} className="text-xs">Cancelar</Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                  {proposta.notas_vendedor || 'Nenhuma nota adicionada.'}
                </p>
              )}
            </div>

            {/* History */}
            {proposta.historico && proposta.historico.length > 0 && (
              <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</p>
                </div>
                <div>
                  {[...proposta.historico]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(h => (
                      <TimelineItem key={h.id} acao={h.acao} descricao={h.descricao} data={h.created_at} />
                    ))}
                </div>
              </div>
            )}

            {/* Link */}
            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Link Público</p>
              <div className="flex items-center gap-2 bg-muted/20 rounded-xl p-2 pr-2">
                <p className="text-xs text-muted-foreground flex-1 truncate font-mono">{publicLink}</p>
                <button onClick={copyLink} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary flex-shrink-0">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up Modal */}
      {showFollowUp && (
        <FollowUpModal open={showFollowUp} onClose={() => setShowFollowUp(false)} proposta={proposta} />
      )}

      {/* Status Modal */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Atualizar Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Novo status</p>
              <Select value={newStatus} onValueChange={v => setNewStatus(v as StatusProposta)}>
                <SelectTrigger className="bg-muted/20 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FLOW.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {newStatus === 'recusada' && (
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">Motivo da recusa</p>
                <Textarea
                  value={motivoRecusa}
                  onChange={e => setMotivoRecusa(e.target.value)}
                  placeholder="Preço, timing, concorrente, sem urgência..."
                  rows={3}
                  className="bg-muted/20 border-border/40 resize-none"
                />
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowStatusModal(false)}>Cancelar</Button>
              <Button onClick={handleStatusChange} disabled={updateStatus.isPending} className="bg-primary hover:bg-primary/90 text-white">
                {updateStatus.isPending ? 'Salvando...' : 'Atualizar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-red-400">Excluir Proposta?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. A proposta de <strong>{lead?.empresa}</strong> será removida permanentemente.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
            <Button
              onClick={handleDelete}
              disabled={deleteProposta.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteProposta.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
