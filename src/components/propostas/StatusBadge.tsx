import { cn } from '@/lib/utils'
import { STATUS_COLORS, STATUS_LABELS, type StatusProposta } from '@/types/propostas'

interface StatusBadgeProps {
  status: StatusProposta
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
        STATUS_COLORS[status],
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {STATUS_LABELS[status]}
    </span>
  )
}
