import { resolveSendCredentials } from "./connection-resolver.ts";

// Avisos internos ao atendente (transferência, "Siga-me") SEMPRE pela
// Evolution, nunca pela conexão de origem da conversa do cliente — mesmo
// quando essa conversa é via Meta API oficial. A Meta só entrega mensagem
// livre pra quem mandou mensagem pro número nas últimas 24h, e o atendente
// notificado quase nunca cumpre essa janela (ele não é o cliente), então o
// aviso falhava silenciosamente sempre que a conversa era via Meta. Não
// passa pelo send_queue porque não é uma mensagem do atendimento, é um
// aviso pro atendente.
export async function sendInternalNotification(
  supabase: any,
  toPhone: string,
  text: string
): Promise<boolean> {
  try {
    const { data: evolutionConn } = await supabase
      .from('whatsapp_connections')
      .select('id')
      .eq('api_type', 'evolution')
      .eq('is_active', true)
      .order('is_connected', { ascending: false })
      .limit(1)
      .maybeSingle();

    const creds = await resolveSendCredentials(supabase, { connectionId: evolutionConn?.id ?? null, apiSource: 'evolution' });
    const cleanPhone = toPhone.replace(/\D/g, '');

    const baseUrl = (creds.evolution_api_url || '').replace(/\/$/, '');
    const response = await fetch(`${baseUrl}/message/sendText/${creds.evolution_instance_name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': creds.evolution_api_key || '' },
      body: JSON.stringify({ number: cleanPhone, text }),
    });
    return response.ok;
  } catch (err) {
    console.error('[InternalNotify] Error sending internal notification:', err);
    return false;
  }
}
