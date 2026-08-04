import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Send, Eye, Copy, ExternalLink, TrendingUp,
  AlertCircle, Pencil, Trash2, History, UserCircle, Presentation,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApresentacao, useUpdateApresentacaoStatus, useDeleteApresentacao, useUpdateApresentacao } from '@/hooks/useApresentacoes'
import { StatusBadge } from '@/components/apresentacoes/StatusBadge'
import { EnviarApresentacaoModal } from '@/components/apresentacoes/EnviarApresentacaoModal'
import { STATUS_LABELS, type StatusApresentacao, type AssinaturaVendedor } from '@/types/apresentacoes'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const STATUS_FLOW: StatusApresentacao[] = ['rascunho', 'enviada', 'visualizada', 'expirada']

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
        <p className="text-xs font-medium text-foreground capitalize">{STATUS_LABELS[acao as StatusApresentacao] ?? acao}</p>
        {descricao && <p className="text-xs text-muted-foreground">{descricao}</p>}
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          {new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
        </p>
      </div>
    </div>
  )
}

export default function ApresentacaoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: apresentacao, isLoading } = useApresentacao(id)
  const updateStatus = useUpdateApresentacaoStatus()
  const updateApresentacao = useUpdateApresentacao()
  const deleteApresentacao = useDeleteApresentacao()

  const [showEnviar, setShowEnviar] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [newStatus, setNewStatus] = useState<StatusApresentacao>('enviada')
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')
  const [editingAssinatura, setEditingAssinatura] = useState(false)
  const [assinatura, setAssinatura] = useState<AssinaturaVendedor>({ nome: '', cargo: '', telefone: '', email: '' })

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!apresentacao) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Apresentação não encontrada</p>
        <Button variant="outline" onClick={() => navigate('/apresentacoes')}>Voltar</Button>
      </div>
    )
  }

  const lead = apresentacao.lead
  const publicLink = `${window.location.origin}/apresentacao/${apresentacao.slug}`

  function copyLink() {
    navigator.clipboard.writeText(publicLink)
    toast.success('Link copiado!')
  }

  async function handleStatusChange() {
    await updateStatus.mutateAsync({ id: apresentacao!.id, status: newStatus })
    setShowStatusModal(false)
  }

  async function handleDelete() {
    await deleteApresentacao.mutateAsync(apresentacao!.id)
    navigate('/apresentacoes')
  }

  async function handleSaveNotes() {
    await updateApresentacao.mutateAsync({ id: apresentacao!.id, notas_vendedor: notes })
    setEditingNotes(false)
    toast.success('Notas salvas!')
  }

  async function handleSaveAssinatura() {
    await updateApresentacao.mutateAsync({ id: apresentacao!.id, assinatura_vendedor: assinatura })
    setEditingAssinatura(false)
    toast.success('Assinatura salva!')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/apresentacoes')} className="p-2 rounded-xl hover:bg-muted/50">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{lead?.empresa}</h1>
                <StatusBadge status={apresentacao.status} />
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
              Ver Apresentação
            </Button>
            <Button
              size="sm"
              onClick={() => setShowEnviar(true)}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
                <Presentation className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Detalhes da Apresentação</h2>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <InfoRow label="Template" value={apresentacao.template?.nome} />
                <InfoRow
                  label="Validade"
                  value={apresentacao.validade_ate
                    ? new Date(apresentacao.validade_ate).toLocaleDateString('pt-BR')
                    : `${apresentacao.validade_dias} dias`}
                />
                <InfoRow label="Criada em" value={new Date(apresentacao.created_at).toLocaleDateString('pt-BR')} />
                {apresentacao.enviada_at && <InfoRow label="Enviada em" value={new Date(apresentacao.enviada_at).toLocaleDateString('pt-BR')} />}
                {apresentacao.visualizada_at && <InfoRow label="Visualizada em" value={new Date(apresentacao.visualizada_at).toLocaleDateString('pt-BR')} />}
                <InfoRow label="Subtítulo personalizado" value={apresentacao.titulo_personalizado} />
              </div>
            </div>

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
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-5">
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
                  onClick={() => { setNewStatus('visualizada'); setShowStatusModal(true) }}
                >
                  <Eye className="w-4 h-4 text-green-400" />
                  Marcar como Visualizada
                </Button>
                <hr className="border-border/40" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-red-400 hover:text-red-400 hover:bg-red-500/10"
                  onClick={() => setShowDeleteModal(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir Apresentação
                </Button>
              </div>
            </div>

            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notas Internas</p>
                <button onClick={() => { setNotes(apresentacao.notas_vendedor ?? ''); setEditingNotes(true) }} className="text-muted-foreground hover:text-primary">
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
                  {apresentacao.notas_vendedor || 'Nenhuma nota adicionada.'}
                </p>
              )}
            </div>

            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Minha Assinatura</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAssinatura(apresentacao.assinatura_vendedor ?? { nome: '', cargo: '', telefone: '', email: '' })
                    setEditingAssinatura(true)
                  }}
                  className="text-muted-foreground hover:text-primary"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
              {editingAssinatura ? (
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input value={assinatura.nome} onChange={e => setAssinatura(a => ({ ...a, nome: e.target.value }))} className="bg-muted/20 border-border/40 h-8 text-xs" placeholder="Marco Silva" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cargo</Label>
                    <Input value={assinatura.cargo} onChange={e => setAssinatura(a => ({ ...a, cargo: e.target.value }))} className="bg-muted/20 border-border/40 h-8 text-xs" placeholder="Consultor Comercial" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <Input value={assinatura.telefone} onChange={e => setAssinatura(a => ({ ...a, telefone: e.target.value }))} className="bg-muted/20 border-border/40 h-8 text-xs" placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <Input value={assinatura.email} onChange={e => setAssinatura(a => ({ ...a, email: e.target.value }))} className="bg-muted/20 border-border/40 h-8 text-xs" placeholder="marco@premacar.com.br" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleSaveAssinatura} disabled={updateApresentacao.isPending} className="flex-1 bg-primary/80 hover:bg-primary text-white text-xs">Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingAssinatura(false)} className="text-xs">Cancelar</Button>
                  </div>
                </div>
              ) : apresentacao.assinatura_vendedor ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{apresentacao.assinatura_vendedor.nome}</p>
                  <p className="text-xs text-muted-foreground">{apresentacao.assinatura_vendedor.cargo}</p>
                  <p className="text-xs text-muted-foreground">{apresentacao.assinatura_vendedor.telefone}</p>
                  <p className="text-xs text-muted-foreground">{apresentacao.assinatura_vendedor.email}</p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma assinatura configurada. Clique no lápis para adicionar.</p>
              )}
            </div>

            {apresentacao.historico && apresentacao.historico.length > 0 && (
              <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Histórico</p>
                </div>
                <div>
                  {[...apresentacao.historico]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .map(h => (
                      <TimelineItem key={h.id} acao={h.acao} descricao={h.descricao} data={h.created_at} />
                    ))}
                </div>
              </div>
            )}

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

      <EnviarApresentacaoModal
        open={showEnviar}
        onClose={() => setShowEnviar(false)}
        apresentacao={apresentacao}
        publicLink={publicLink}
      />

      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Atualizar Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Novo status</p>
              <Select value={newStatus} onValueChange={v => setNewStatus(v as StatusApresentacao)}>
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
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowStatusModal(false)}>Cancelar</Button>
              <Button onClick={handleStatusChange} disabled={updateStatus.isPending} className="bg-primary hover:bg-primary/90 text-white">
                {updateStatus.isPending ? 'Salvando...' : 'Atualizar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="max-w-sm bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-red-400">Excluir Apresentação?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação é irreversível. A apresentação de <strong>{lead?.empresa}</strong> será removida permanentemente.
          </p>
          <div className="flex gap-2 justify-end mt-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
            <Button
              onClick={handleDelete}
              disabled={deleteApresentacao.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteApresentacao.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
