import { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MessageCircle, Mail, Check, ExternalLink } from 'lucide-react'
import { useUpdatePropostaStatus } from '@/hooks/usePropostas'
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

  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp')
  const [sent, setSent] = useState(false)
  const [waMsg, setWaMsg] = useState('')
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

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

  // Reinicia o formulário toda vez que o modal abre
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

  async function handleSend() {
    if (channel === 'whatsapp') {
      const phone = formatPhone(lead?.telefone ?? '')
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(waMsg)}`, '_blank')
    } else {
      const mailto = `mailto:${emailTo}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`
      window.open(mailto, '_blank')
    }

    // Atualiza status para 'enviada' se ainda era rascunho
    if (proposta.status === 'rascunho') {
      await updateStatus.mutateAsync({ id: proposta.id, status: 'enviada' })
    }

    setSent(true)
    setTimeout(() => { onClose(); setSent(false) }, 1500)
  }

  const canSend = channel === 'whatsapp'
    ? !!(lead?.telefone) && waMsg.trim().length > 0
    : emailTo.trim().length > 0 && emailSubject.trim().length > 0

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
              'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all',
              channel === 'whatsapp'
                ? 'border-green-500 bg-green-500/10'
                : 'border-border/40 hover:border-green-500/30 hover:bg-muted/20',
            )}
          >
            <MessageCircle className={cn('w-7 h-7', channel === 'whatsapp' ? 'text-green-400' : 'text-muted-foreground')} />
            <span className={cn('text-sm font-semibold', channel === 'whatsapp' ? 'text-green-400' : 'text-muted-foreground')}>
              WhatsApp
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-full px-1">
              {lead?.telefone ?? 'Sem telefone'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setChannel('email')}
            className={cn(
              'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all',
              channel === 'email'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-border/40 hover:border-blue-500/30 hover:bg-muted/20',
            )}
          >
            <Mail className={cn('w-7 h-7', channel === 'email' ? 'text-blue-400' : 'text-muted-foreground')} />
            <span className={cn('text-sm font-semibold', channel === 'email' ? 'text-blue-400' : 'text-muted-foreground')}>
              E-mail
            </span>
            <span className={cn('text-xs truncate max-w-full px-1', lead?.email ? 'text-muted-foreground' : 'text-orange-400')}>
              {lead?.email ?? 'Sem e-mail cadastrado'}
            </span>
          </button>
        </div>

        {/* Formulário WhatsApp */}
        {channel === 'whatsapp' && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Para (número com DDD)</Label>
              <Input
                value={lead?.telefone ?? ''}
                readOnly
                className="bg-muted/30 border-border/40 text-sm text-muted-foreground"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <Textarea
                value={waMsg}
                onChange={e => setWaMsg(e.target.value)}
                rows={9}
                className="bg-muted/20 border-border/40 resize-none text-sm font-mono leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* Formulário E-mail */}
        {channel === 'email' && (
          <div className="space-y-3">
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
                rows={9}
                className="bg-muted/20 border-border/40 resize-none text-sm leading-relaxed"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            onClick={handleSend}
            disabled={!canSend || updateStatus.isPending || sent}
            className={cn(
              'flex-1 gap-2 text-white',
              sent ? 'bg-green-600 hover:bg-green-600' : 'bg-primary hover:bg-primary/90',
            )}
          >
            {sent ? (
              <><Check className="w-4 h-4" /> Enviado!</>
            ) : channel === 'whatsapp' ? (
              <><MessageCircle className="w-4 h-4" /> Abrir no WhatsApp</>
            ) : (
              <><ExternalLink className="w-4 h-4" /> Abrir no E-mail</>
            )}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
