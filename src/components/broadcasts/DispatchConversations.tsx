import React from 'react';
import { useDispatchConversations } from '@/hooks/useDispatchConversations';
import { MessageSquare, Check, CheckCheck, Eye, Loader2, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const DispatchConversations: React.FC = () => {
  const { data: conversations, isLoading } = useDispatchConversations();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando conversas...</span>
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
        <p className="text-lg font-medium">Nenhuma conversa de disparo pendente</p>
        <p className="text-sm mt-1">Quando você enviar disparos, as conversas sem resposta aparecerão aqui</p>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read':
        return <CheckCheck className="w-4 h-4 text-primary" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
      default:
        return <Check className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'read':
        return <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">Lida</Badge>;
      case 'delivered':
        return <Badge variant="outline" className="text-accent border-accent/30 bg-accent/10">Entregue</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground border-border">Enviada</Badge>;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {conversations.length} conversa{conversations.length !== 1 ? 's' : ''} aguardando resposta
        </p>
      </div>

      <div className="space-y-2">
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-card/50 border border-border/50 hover:bg-card/80 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground truncate">{conv.contactName}</p>
                {getStatusBadge(conv.status)}
              </div>
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {conv.lastMessageContent || 'Mensagem enviada'}
              </p>
            </div>

            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(conv.dispatchSentAt), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </div>
              {getStatusIcon(conv.status)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
