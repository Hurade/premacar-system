import { Building2, Calendar, ChevronRight, TrendingUp, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'
import type { Proposta } from '@/types/propostas'
import { PLANOS_PADRAO, formatarMoeda, TIPO_NEGOCIO_LABELS } from '@/types/propostas'
import { cn } from '@/lib/utils'

interface PropostaCardProps {
  proposta: Proposta
  className?: string
}

export function PropostaCard({ proposta, className }: PropostaCardProps) {
  const navigate = useNavigate()
  const lead = proposta.lead
  const valorLiquido = proposta.valor_mensal * (1 - proposta.desconto_percentual / 100)
  const planoInfo = proposta.plano?.tipo
    ? PLANOS_PADRAO[proposta.plano.tipo as keyof typeof PLANOS_PADRAO]
    : null

  const validade = proposta.validade_ate
    ? new Date(proposta.validade_ate).toLocaleDateString('pt-BR')
    : null

  const isExpired =
    proposta.validade_ate && new Date(proposta.validade_ate) < new Date() && proposta.status !== 'aceita'

  return (
    <div
      onClick={() => navigate(`/propostas/${proposta.id}`)}
      className={cn(
        'group relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5 cursor-pointer',
        'hover:border-primary/30 hover:bg-card/80 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5',
        className,
      )}
    >
      {/* Plan accent bar */}
      {planoInfo && (
        <div
          className="absolute top-0 left-0 w-1 h-full rounded-l-2xl"
          style={{ backgroundColor: planoInfo.cor }}
        />
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate text-sm">{lead?.empresa}</p>
            <p className="text-xs text-muted-foreground truncate">
              {lead?.tipo_negocio ? TIPO_NEGOCIO_LABELS[lead.tipo_negocio] : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={proposta.status} />
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <User className="w-3 h-3" />
        <span className="truncate">{lead?.responsavel}</span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <div>
            <p className="text-sm font-bold text-foreground">
              {formatarMoeda(valorLiquido)}<span className="text-xs font-normal text-muted-foreground">/mês</span>
            </p>
            {proposta.desconto_percentual > 0 && (
              <p className="text-[10px] text-green-400">-{proposta.desconto_percentual}% desconto</p>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {proposta.plano?.nome ?? 'Sem plano'}
          </p>
          {validade && (
            <p className={cn('text-[10px] flex items-center gap-1 mt-0.5', isExpired ? 'text-red-400' : 'text-muted-foreground')}>
              <Calendar className="w-2.5 h-2.5" />
              {isExpired ? 'Expirada' : `Até ${validade}`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
