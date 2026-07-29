// Dispara o nina-orchestrator de forma confiável após enfileirar uma
// mensagem em nina_processing_queue. Antes disso, meta-webhook e
// whatsapp-webhook faziam um fetch "fire-and-forget" (sem retry, e no caso
// do whatsapp-webhook nem sequer aguardado) — uma falha transitória de rede
// ou cold start deixava o item preso em 'pending' até a próxima mensagem do
// mesmo contato reprocessar a fila (o que pode nunca acontecer).
export async function triggerNinaOrchestrator(
  supabaseUrl: string,
  supabaseServiceKey: string,
  triggeredBy: string,
): Promise<boolean> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/nina-orchestrator`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ triggered_by: triggeredBy }),
      });
      if (response.ok) return true;
      console.error(`[TriggerOrchestrator] nina-orchestrator respondeu ${response.status} (tentativa ${attempt})`);
    } catch (err) {
      console.error(`[TriggerOrchestrator] Erro ao chamar nina-orchestrator (tentativa ${attempt}):`, err);
    }
    if (attempt === 1) await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}
