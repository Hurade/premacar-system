import { useState } from 'react'
import { Check, Copy, MessageCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Proposta } from '@/types/propostas'
import { formatarMoeda } from '@/types/propostas'
import { toast } from 'sonner'

interface FollowUpModalProps {
  open: boolean
  onClose: () => void
  proposta: Proposta
}

function buildLink(slug: string) {
  return `${window.location.origin}/p/${slug}`
}

function buildMessages(proposta: Proposta) {
  const empresa = proposta.lead?.empresa ?? 'sua empresa'
  const responsavel = proposta.lead?.responsavel ?? 'prezado(a)'
  const valor = proposta.valor_mensal
    ? formatarMoeda(proposta.valor_mensal * (1 - proposta.desconto_percentual / 100))
    : ''
  const plano = proposta.plano?.nome ?? 'nosso plano'
  const link = buildLink(proposta.slug)
  const validade = proposta.validade_ate
    ? new Date(proposta.validade_ate).toLocaleDateString('pt-BR')
    : ''

  return {
    apos_envio: `Olá ${responsavel}! Acabei de enviar a proposta da Prema Car para ${empresa}. O link para visualizar está aqui: ${link}\n\nQualquer dúvida estou à disposição! 🚀`,

    sem_resposta: `Oi ${responsavel}, tudo bem? Queria saber se chegou a ver a proposta que enviei para ${empresa}.\n\nEla inclui o ${plano} por ${valor}/mês — acredito que vai fazer muito sentido para vocês. Alguma dúvida?\n\n${link}`,

    antes_vencer: `${responsavel}, bom dia! A proposta da Prema Car para ${empresa} vence em breve (${validade}).\n\nSe quiser garantir as condições atuais, é só me confirmar! ${link}`,

    apos_vencer: `Olá ${responsavel}! A proposta para ${empresa} acabou de vencer, mas ainda posso reactivar com as mesmas condições se fecharmos hoje.\n\nPode conversar? 😊`,

    apos_aceite: `${responsavel}, que ótima notícia! Proposta aceita para ${empresa}! 🎉\n\nVou acionar o time para iniciar o onboarding. Fique de olho no seu e-mail com os próximos passos.\n\nObrigado pela confiança!`,

    apos_recusa: `Olá ${responsavel}, tudo bem? Entendi que nesse momento não é o ideal para seguir com a Prema Car.\n\nSe quiser, posso revisitar a proposta ou apresentar outras opções mais adequadas ao momento de ${empresa}. Quando fizer sentido, estou aqui! 🤝`,
  }
}

const TABS = [
  { key: 'apos_envio', label: 'Após envio' },
  { key: 'sem_resposta', label: 'Sem resposta' },
  { key: 'antes_vencer', label: 'Antes de vencer' },
  { key: 'apos_vencer', label: 'Após vencer' },
  { key: 'apos_aceite', label: 'Após aceite' },
  { key: 'apos_recusa', label: 'Após recusa' },
]

export function FollowUpModal({ open, onClose, proposta }: FollowUpModalProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const messages = buildMessages(proposta)

  function copyMessage(key: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    toast.success('Mensagem copiada!')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Mensagens de Follow-up
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-2">
          Copie a mensagem ideal para cada momento da negociação com{' '}
          <span className="text-foreground font-medium">{proposta.lead?.empresa}</span>.
        </p>

        <Tabs defaultValue="apos_envio" className="mt-2">
          <TabsList className="grid grid-cols-3 h-auto gap-1 bg-muted/30 p-1">
            {TABS.map(t => (
              <TabsTrigger key={t.key} value={t.key} className="text-xs py-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map(t => (
            <TabsContent key={t.key} value={t.key} className="mt-3">
              <div className="relative bg-muted/20 border border-border/40 rounded-xl p-4 pr-14">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {messages[t.key as keyof typeof messages]}
                </p>
                <button
                  onClick={() => copyMessage(t.key, messages[t.key as keyof typeof messages])}
                  className="absolute top-3 right-3 p-2 rounded-lg hover:bg-primary/10 transition-colors text-muted-foreground hover:text-primary"
                >
                  {copied === t.key
                    ? <Check className="w-4 h-4 text-green-400" />
                    : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Link da proposta incluído automaticamente
              </p>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose} className="gap-2">
            <X className="w-4 h-4" />
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
