import { resolveSendCredentials } from "./connection-resolver.ts";

// Envia um texto simples via a conexão de origem da conversa (Evolution ou
// Meta, conforme resolveSendCredentials) — usado para avisos internos ao
// atendente (transferência, "Siga-me"), não passa pelo send_queue porque
// não é uma mensagem do atendimento, é um aviso pro atendente.
export async function sendInternalNotification(
  supabase: any,
  connectionId: string | null,
  toPhone: string,
  text: string
): Promise<boolean> {
  try {
    const creds = await resolveSendCredentials(supabase, { connectionId, apiSource: 'evolution' });
    const cleanPhone = toPhone.replace(/\D/g, '');

    if (creds.api_type === 'meta') {
      const response = await fetch(`https://graph.facebook.com/v18.0/${creds.meta_phone_number_id}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creds.meta_access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp', recipient_type: 'individual', to: cleanPhone,
          type: 'text', text: { body: text },
        }),
      });
      return response.ok;
    }

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
