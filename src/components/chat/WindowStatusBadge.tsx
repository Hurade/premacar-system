import { Clock, AlertTriangle } from 'lucide-react';

interface WindowStatusBadgeProps {
  status: 'open' | 'expired' | 'not_found';
  hoursRemaining?: number;
  apiSource?: string;
}

export function WindowStatusBadge({ status, hoursRemaining, apiSource }: WindowStatusBadgeProps) {
  // Only show for Meta API conversations
  if (apiSource !== 'meta') return null;

  if (status === 'expired' || status === 'not_found') {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 bg-red-500/20 text-red-400 border border-red-500/30">
        <AlertTriangle className="h-3 w-3" />
        Janela Expirada
      </span>
    );
  }

  const isExpiringSoon = hoursRemaining !== undefined && hoursRemaining < 2;

  if (isExpiringSoon) {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
        <Clock className="h-3 w-3" />
        {Math.floor((hoursRemaining || 0) * 60)}min restantes
      </span>
    );
  }

  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1 bg-green-500/20 text-green-400 border border-green-500/30">
      <Clock className="h-3 w-3" />
      {Math.floor(hoursRemaining || 0)}h restantes
    </span>
  );
}
