import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, Mail, Check, MessagesSquare, UserPlus, ExternalLink, Loader2 } from 'lucide-react'
import { useUpdatePropostaStatus } from '@/hooks/usePropostas'
import { supabase } from '@/integrations/supabase/client'
import { toast } from 'sonner'
import type { Proposta } from '@/types/propostas'
import { cn } from '@/lib/utils'

interface Props {
  proposta: Proposta
  publicLink: string
  open: boolean
  onClose: () => void
}

function formatPhone(tel: string): string {
  const digits = tel.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}

export function EnviarPropostaModal({ proposta, publicLink, open, onClose }: Props) {
  const lead = proposta.lead
  const assinatura = proposta.assinatura_vendedor
  const updateStatus = useUpdatePropostaStatus()
  const navigate = useNavigate()

  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [sent, setSent] = useState(false)
  const [waMsg, setWaMsg] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  // Conversation lookup state
  const [chatConvId, setChatConvId] = useState<string | null>(null)
  const [chatConvActive, setChatConvActive] = useState(false)
  const [chatContactId, setChatContactId] = useState<string | null>(null)
  const [lookingUpConv, setLookingUpConv] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)

  const assinaturaBlock = useMemo(() => {
    if (!assinatura) return 'Equipe Prema Car'
    return [assinatura.nome, assinatura.cargo, assinatura.telefone, assinatura.email]
      .filter(Boolean).join('\n')
  }, [assinatura])

  const defaultWaMsg = useMemo(() =>
    `Olá${lead?.responsavel ? ` ${lead.responsavel}` : ''}! 👋\n\n` +
    `Preparei uma proposta especial da *Prema Car* para o *${lead?.empresa ?? 'sua empresa'}*.\n\n` +
    `🔗 Acesse aqui: ${publicLink}\n\n` +
    `Qualquer dúvida, estou à disposição!\n\n` +
    `Atenciosamente,\n${assinaturaBlock}`,
  [lead, publicLink, assinaturaBlock])

  const defaultEmailBody = useMemo(() =>
    `Olá${lead?.responsavel ? ` ${lead.responsavel}` : ''},\n\n` +
    `Preparei uma proposta comercial da Prema Car especialmente para ${lead?.empresa ?? 'sua empresa'}.\n\n` +
    `Acesse pelo link abaixo para ver todos os detalhes:\n${publicLink}\n\n` +
    `Ficamos à disposição para esclarecer qualquer dúvida.\n\n` +
    `Atenciosamente,\n${assinaturaBlock}`,
  [lead, publicLink, assinaturaBlock])

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setChannel('whatsapp')
      setSent(false)
      setWaMsg(defaultWaMsg)
      setEmailTo(lead?.email ?? '')
      setEmailSubject(`Proposta Prema Car — ${lead?.empresa ?? ''}`)
      setEmailBody(defaultEmailBody)
    }
  }, [open, defaultWaMsg, defaultEmailBody, lead?.email, lead?.empresa])

  // Lookup conversation in the system by lead phone number
  useEffect(() => {
    if (!open || !lead?.telefone) {
      setChatConvId(null)
      setChatContactId(null)
      return
    }

    setChatConvId(null)
    setChatConvActive(false)
    setChatContactId(null)
    setLookingUpConv(true)

    const digits = lead.telefone.replace(/\D/g, '')
    const last10 = digits.slice(-10)

    ;(async () => {
      try {
        // Find contact by last 10 digits of phone (handles different country code formats)
        const { data: contacts } = await (supabase as any)
          .from('contacts')
          .select('id')
          .ilike('phone_number', `%${last10}`)
          .limit(1)

        const contact = contacts?.[0]
        if (!contact) return

        setChatContactId(contact.id)

        // Find most recent conversation for this contact
        const { data: convs } = await (supabase as any)
          .from('conversations')
          .select('id, status, is_active')
          .eq('contact_id', contact.id)
          .order('last_message_at', { ascending: false })
          .limit(1)

        if (convs?.[0]) {
          const conv = convs[0]
          setChatConvId(conv.id)
          setChatConvActive(conv.status === 'nina' || conv.status === 'human')
        }
      } finally {
        setLookingUpConv(false)
      }
    })()
  }, [open, lead?.telefone])

  async function handleSend() {
    if (channel === 'whatsapp') {
      // Update status first if rascunho
      if (proposta.status === 'rascunho') {
        await updateStatus.mutateAsync({ id: proposta.id, status: 'enviada' })
      }

      // Navigate to existing conversation or create new one
      if (chatConvId) {
        if (!chatConvActive) {
          // Reopen closed/paused conversation
          await (supabase as any)
            .from('conversations')
            .update({ status: 'human', is_active: true })
            .eq('id', chatConvId)
        }
        navigate(`/chat?conversation=${chatConvId}`)
      } else if (chatContactId) {
        navigate(`/chat?newContact=${chatContactId}`)
      } else {
        // Fallback: open WhatsApp web if contact not in system
        const phone = formatPhone(lead?.telefone ?? '')
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`, '_blank')
      }

      onClose()
    } else {
      // Email via AWS SES edge function
      setSendingEmail(true)
      try {
        const htmlBody = `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #333">${emailBody.replace(/\n/g, '<br>')}</div>`

        const { data, error } = await supabase.functions.invoke('send-proposal-email', {
          body: { to: emailTo, subject: emailSubject, body: htmlBody, proposal_id: proposta.id },
        })

        if (error || !data?.success) {
          toast.error(data?.error ?? error?.message ?? 'Erro ao enviar e-mail')
          return
        }

        if (proposta.status === 'rascunho') {
          await updateStatus.mutateAsync({ id: proposta.id, status: 'enviada' })
        }

        setSent(true)
        setTimeout(() => { onClose(); setSent(false) }, 1500)
      } finally {
        setSendingEmail(false)
      }
    }
  }

  const waStatus = lookingUpConv
    ? 'buscando...'
    : chatConvId
      ? chatConvActive ? 'conversa em andamento' : 'conversa encerrada'
      : chatContactId
        ? 'contato no sistema'
        : lead?.telefone
          ? 'não cadastrado'
          : 'sem telefone'

  const waStatusColor = chatConvId
    ? chatConvActive ? 'text-emerald-400' : 'text-amber-400'
    : chatContactId
      ? 'text-cyan-400'
      : 'text-muted-foreground'

  const canSend = channel === 'whatsapp'
    ? !lookingUpConv && !!(chatConvId || chatContactId || lead?.telefone)
    : emailTo.trim().length > 0 && emailSubject.trim().length > 0 && !sendingEmail

  const isLoading = updateStatus.isPending || sendingEmail

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Enviar Proposta
            <span className="text-xs font-normal text-muted-foreground ml-1">— {lead?.empresa}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Seletor de canal */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setChannel('whatsapp')}
            className={cn(
              'flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all',
              channel === 'whatsapp'
                ? 'border-green-500 bg-green-500/10'
                : 'border-border/40 hover:border-green-500/30 hover:bg-muted/20',
            )}
          >
            <MessageCircle className={cn('w-7 h-7', channel === 'whatsapp' ? 'text-green-400' : 'text-muted-foreground')} />
            <span className={cn('text-sm font-semibold', channel === 'whatsapp' ? 'text-green-400' : 'text-muted-foreground')}>
              WhatsApp
            </span>
            <span className={cn('text-[10px] font-medium', waStatusColor)}>
              {lookingUpConv ? (
                <span className="flex items-center gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> buscando...</span>
              ) : waStatus}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setChannel('email')}
            className={cn(
              'flex flex-col items-center gap-1 p-4 rounded-xl border-2 transition-all',
              channel === 'email'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-border/40 hover:border-blue-500/30 hover:bg-muted/20',
            )}
          >
            <Mail className={cn('w-7 h-7', channel === 'email' ? 'text-blue-400' : 'text-muted-foreground')} />
            <span className={cn('text-sm font-semibold', channel === 'email' ? 'text-blue-400' : 'text-muted-foreground')}>
              E-mail
            </span>
            <span className={cn('text-[10px] truncate max-w-full px-1', lead?.email ? 'text-muted-foreground' : 'text-orange-400')}>
              {lead?.email ?? 'Sem e-mail cadastrado'}
            </span>
          </button>
        </div>

        {/* Formulário WhatsApp */}
        {channel === 'whatsapp' && (
          <div className="space-y-3">
            {/* Status da conversa */}
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
              chatConvId
                ? chatConvActive
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : chatContactId
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                  : 'bg-muted/30 text-muted-foreground border border-border/30',
            )}>
              {chatConvId ? (
                chatConvActive
                  ? <><MessagesSquare className="w-3.5 h-3.5 shrink-0" /> Conversa em andamento encontrada — será aberta no Chat</>
                  : <><MessagesSquare className="w-3.5 h-3.5 shrink-0" /> Conversa encerrada encontrada — será reaberta no Chat</>
              ) : chatContactId ? (
                <><UserPlus className="w-3.5 h-3.5 shrink-0" /> Contato encontrado — nova conversa será iniciada no Chat</>
              ) : (
                <><ExternalLink className="w-3.5 h-3.5 shrink-0" /> Contato não cadastrado — abrirá no WhatsApp Web</>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Para (número com DDD)</Label>
              <Input
                value={lead?.telefone ?? ''}
                readOnly
                className="bg-muted/30 border-border/40 text-sm text-muted-foreground"
              />
            </div>

            {/* Mensagem só exibida como referência quando abrindo WhatsApp Web */}
            {!chatConvId && !chatContactId && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Mensagem (WhatsApp Web)</Label>
                <Textarea
                  value={waMsg}
                  onChange={e => setWaMsg(e.target.value)}
                  rows={8}
                  className="bg-muted/20 border-border/40 resize-none text-sm font-mono leading-relaxed"
                />
              </div>
            )}
          </div>
        )}

        {/* Formulário E-mail */}
        {channel === 'email' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Mail className="w-3.5 h-3.5 shrink-0" /> E-mail enviado diretamente pelo sistema via AWS SES
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Para</Label>
              <Input
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                type="email"
                placeholder="email@empresa.com"
                className="bg-muted/20 border-border/40 text-sm"
              />
              {!lead?.email && (
                <p className="text-xs text-orange-400">Nenhum e-mail no cadastro do lead. Preencha manualmente.</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Assunto</Label>
              <Input
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                className="bg-muted/20 border-border/40 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <Textarea
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                rows={8}
                className="bg-muted/20 border-border/40 resize-none text-sm leading-relaxed"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSend}
            disabled={!canSend || isLoading || sent}
            className={cn(
              'flex-1 gap-2 text-white',
              sent ? 'bg-green-600 hover:bg-green-600' : 'bg-primary hover:bg-primary/90',
            )}
          >
            {sent ? (
              <><Check className="w-4 h-4" /> Enviado!</>
            ) : isLoading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
            ) : channel === 'whatsapp' ? (
              chatConvId
                ? <><MessagesSquare className="w-4 h-4" /> {chatConvActive ? 'Abrir Conversa' : 'Reabrir Conversa'}</>
                : chatContactId
                  ? <><UserPlus className="w-4 h-4" /> Iniciar Conversa</>
                  : <><MessageCircle className="w-4 h-4" /> Abrir no WhatsApp</>
            ) : (
              <><Mail className="w-4 h-4" /> Enviar E-mail</>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
