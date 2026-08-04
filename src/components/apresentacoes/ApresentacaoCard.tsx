import { Building2, Calendar, ChevronRight, Eye, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from './StatusBadge'
import type { Apresentacao } from '@/types/apresentacoes'
import { cn } from '@/lib/utils'

interface ApresentacaoCardProps {
  apresentacao: Apresentacao
  className?: string
}

export function ApresentacaoCard({ apresentacao, className }: ApresentacaoCardProps) {
  const navigate = useNavigate()
  const lead = apresentacao.lead

  const validade = apresentacao.validade_ate
    ? new Date(apresentacao.validade_ate).toLocaleDateString('pt-BR')
    : null

  const isExpired =
    apresentacao.validade_ate && new Date(apresentacao.validade_ate) < new Date() && apresentacao.status !== 'visualizada'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/apresentacoes/${apresentacao.id}`)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate(`/apresentacoes/${apresentacao.id}`) }}
      className={cn(
        'group relative bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5 cursor-pointer',
        'hover:border-primary/30 hover:bg-card/80 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate text-sm">{lead?.empresa}</p>
            <p className="text-xs text-muted-foreground truncate">{apresentacao.template?.nome ?? 'Sem template'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={apresentacao.status} />
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <User className="w-3 h-3" />
        <span className="truncate">{lead?.responsavel}</span>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs">
            {apresentacao.visualizada_at
              ? `Visualizada em ${new Date(apresentacao.visualizada_at).toLocaleDateString('pt-BR')}`
              : apresentacao.enviada_at
                ? `Enviada em ${new Date(apresentacao.enviada_at).toLocaleDateString('pt-BR')}`
                : 'Ainda não enviada'}
          </span>
        </div>

        {validade && (
          <p className={cn('text-[10px] flex items-center gap-1', isExpired ? 'text-red-400' : 'text-muted-foreground')}>
            <Calendar className="w-2.5 h-2.5" />
            {isExpired ? 'Expirada' : `Até ${validade}`}
          </p>
        )}
      </div>
    </div>
  )
}
