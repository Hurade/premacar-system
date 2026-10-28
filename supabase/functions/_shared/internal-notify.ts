import { resolveSendCredentials } from "./connection-resolver.ts";

// Avisos internos ao atendente (transferência, "Siga-me") SEMPRE pela
// Evolution, nunca pela conexão de origem da conversa do cliente — mesmo
// quando essa conversa é via Meta API oficial. A Meta só entrega mensagem
// livre pra quem mandou mensagem pro número nas últimas 24h, e o atendente
// notificado quase nunca cumpre essa janela (ele não é o cliente), então o
// aviso falhava silenciosamente sempre que a conversa era via Meta. Não
// passa pelo send_queue porque não é uma mensagem do atendimento, é um
// aviso pro atendente.
/** Avisa os gestores (team_members.role='admin', ativos, com telefone de
 * notificação) sobre eventos de infraestrutura — número desconectado,
 * falha grave, campanha pausada por erro — que senão só aparecem em
 * system_logs, invisíveis pra quem não entra no painel. Reaproveita o
 * mesmo canal (Evolution) já usado pra avisar sobre handoff de lead. */
export async function notifyAdmins(supabase: any, text: string): Promise<number> {
  const { data: admins } = await supabase
    .from('team_members')
    .select('name, notification_phone')
    .eq('role', 'admin')
    .eq('status', 'active')
    .not('notification_phone', 'is', null);

  let notified = 0;
  for (const admin of admins || []) {
    try {
      const sent = await sendInternalNotification(supabase, admin.notification_phone, text);
      if (sent) notified++;
    } catch (err) {
      console.error(`[InternalNotify] Falha ao avisar gestor ${admin.name}:`, err);
    }
  }
  return notified;
}

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
