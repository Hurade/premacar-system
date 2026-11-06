import { resolveSendCredentials } from "./connection-resolver.ts";
import { sendWhatsAppMessage } from "./whatsapp-send.ts";

// Extraído de automation-executor/index.ts para ser reaproveitado também
// pelo automation-delayed-processor (ações com delay_hours) — mesma lógica
// por tipo de ação nos dois lugares, uma única fonte de verdade.

export interface AutomationActionDef {
  type: string;
  params: Record<string, unknown>;
  delay_hours?: number;
}

export async function executeSingleAction(
  supabase: any,
  action: AutomationActionDef,
  context: Record<string, any>,
  chainDepth: number,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<{ type: string; success: boolean; error?: string }> {
  try {
    switch (action.type) {
      case 'send_message': {
        if (!context.contact?.id) throw new Error('Sem contato para enviar mensagem');
        if (context.contact.is_blocked) {
          console.log('[automation-actions] Contato bloqueado, pulando envio de mensagem:', context.contact.id);
          break;
        }
        const message = String(action.params.message || '');
        if (context.conversation_id) {
          // Conversa ativa existe — mantém o caminho de sempre (fila de
          // envio, respeita o fluxo normal de atendimento da conversa).
          const { error } = await supabase.from('send_queue').insert({
            conversation_id: context.conversation_id,
            contact_id: context.contact.id,
            message_type: 'text',
            from_type: 'nina',
            content: message,
            priority: 2,
          });
          if (error) throw error;
        } else {
          // Sem conversa ativa — caso comum em automação de nutrição, onde
          // o contato pode estar frio há tempos. send_queue exige
          // conversation_id; em vez de falhar aqui, manda direto pela API
          // (Evolution/Meta), igual o recurring-campaign-processor já faz.
          const creds = await resolveSendCredentials(supabase, {
            connectionId: (action.params.connection_id as string) || null,
            apiSource: 'evolution',
          });
          const sendResult = await sendWhatsAppMessage(context.contact, { message }, creds, supabase);
          if (!sendResult.success) throw new Error(sendResult.error || 'Falha ao enviar mensagem direta');
        }
        break;
      }
      case 'apply_tag':
      case 'remove_tag': {
        if (!context.contact?.id) throw new Error('Sem contato para aplicar/remover tag');
        const tag = String(action.params.tag || '');
        const currentTags: string[] = context.contact.tags || [];
        const nextTags =
          action.type === 'apply_tag'
            ? currentTags.includes(tag) ? currentTags : [...currentTags, tag]
            : currentTags.filter((t) => t !== tag);
        const { error } = await supabase.from('contacts').update({ tags: nextTags }).eq('id', context.contact.id);
        if (error) throw error;
        context.contact.tags = nextTags;

        // Encadeamento controlado: uma automação de tag pode disparar outra,
        // até MAX_CHAIN_DEPTH níveis, evitando loop infinito síncrono. Uma
        // etapa que chega aqui vinda de uma ação com delay (processada
        // horas/dias depois, não na mesma cadeia síncrona) deve resetar a
        // profundidade — ver automation-delayed-processor.
        if (action.type === 'apply_tag') {
          fetch(`${supabaseUrl}/functions/v1/automation-executor`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${supabaseServiceKey}` },
            body: JSON.stringify({
              event_type: 'tag_applied',
              contact_id: context.contact.id,
              conversation_id: context.conversation_id,
              tags: [tag],
              chain_depth: chainDepth + 1,
            }),
          }).catch((err) => console.error('[automation-actions] Erro ao encadear tag_applied:', err));
        }
        break;
      }
      case 'move_stage': {
        if (!context.deal?.id) throw new Error('Sem deal para mover de estágio');
        const stageId = String(action.params.stage_id || '');
        const { data: stage } = await supabase.from('pipeline_stages').select('title').eq('id', stageId).maybeSingle();
        const { error } = await supabase
          .from('deals')
          .update({ stage_id: stageId, stage: stage?.title || null, updated_at: new Date().toISOString() })
          .eq('id', context.deal.id);
        if (error) throw error;
        break;
      }
      case 'create_task': {
        if (!context.deal?.id) throw new Error('Sem deal para criar tarefa');
        const { error } = await supabase.from('deal_activities').insert({
          deal_id: context.deal.id,
          type: 'task',
          title: String(action.params.title || 'Tarefa automática'),
          description: action.params.description ? String(action.params.description) : null,
          scheduled_at: action.params.scheduled_at || null,
        });
        if (error) throw error;
        break;
      }
      default:
        throw new Error(`Tipo de ação desconhecido: ${action.type}`);
    }
    return { type: action.type, success: true };
  } catch (actionError) {
    const message = actionError instanceof Error ? actionError.message : 'Erro desconhecido';
    console.error(`[automation-actions] Erro na ação ${action.type}:`, message);
    return { type: action.type, success: false, error: message };
  }
}
