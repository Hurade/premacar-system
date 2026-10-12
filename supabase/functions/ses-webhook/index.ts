import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { saveLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE = "ses-webhook";

// AWS SNS manda o corpo como texto puro (Content-Type: text/plain), mesmo
// sendo JSON — lendo como texto e parseando manualmente em vez de usar
// req.json() direto, pra não depender do content-type bater.
//
// Sem verificação de assinatura SNS aqui (seria mais uma camada de cripto
// pra implementar) — risco aceito por enquanto, já que esse endpoint só
// ATUALIZA status de entrega (delivered/bounced/complained), nunca lê
// nem expõe dado sensível; o pior caso de um POST forjado é marcar um
// envio como entregue/rejeitado incorretamente.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const rawBody = await req.text();
    const envelope = JSON.parse(rawBody);

    console.log(`[${SOURCE}] Type: ${envelope.Type}`);

    // Confirmação de inscrição no tópico SNS — a AWS exige visitar a
    // SubscribeURL pra ativar o recebimento de notificações futuras.
    if (envelope.Type === "SubscriptionConfirmation") {
      console.log(`[${SOURCE}] Confirmando inscrição SNS:`, envelope.SubscribeURL);
      const confirmResp = await fetch(envelope.SubscribeURL);
      const confirmed = confirmResp.ok;
      await saveLog(supabase, {
        source: SOURCE,
        level: confirmed ? "info" : "error",
        message: confirmed ? "Inscrição SNS confirmada com sucesso" : "Falha ao confirmar inscrição SNS",
        metadata: { topic_arn: envelope.TopicArn, status: confirmResp.status },
      });
      return new Response(JSON.stringify({ success: confirmed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (envelope.Type === "UnsubscribeConfirmation") {
      console.log(`[${SOURCE}] Unsubscribe confirmation recebida (ignorado)`);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (envelope.Type !== "Notification") {
      return new Response(JSON.stringify({ success: true, ignored: envelope.Type }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sesEvent = JSON.parse(envelope.Message);
    const eventType = sesEvent.eventType || sesEvent.notificationType; // v2 usa eventType, v1 usava notificationType
    const messageId = sesEvent.mail?.messageId;

    console.log(`[${SOURCE}] SES event: ${eventType}, messageId: ${messageId}`);

    if (!messageId) {
      return new Response(JSON.stringify({ success: true, ignored: "no_message_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (eventType === "Delivery") {
      updateData.delivered_at = new Date().toISOString();
    } else if (eventType === "Bounce") {
      updateData.bounced_at = new Date().toISOString();
      updateData.error = `Bounce (${sesEvent.bounce?.bounceType || "unknown"}): ${sesEvent.bounce?.bouncedRecipients?.[0]?.diagnosticCode || ""}`.slice(0, 500);
    } else if (eventType === "Complaint") {
      updateData.complained_at = new Date().toISOString();
    } else {
      // "Send"/"Reject"/outros — nada a atualizar além do que o envio já registrou
      return new Response(JSON.stringify({ success: true, ignored: eventType }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("campaign_message_events")
      .update(updateData)
      .eq("ses_message_id", messageId)
      .select("id");

    if (error) {
      console.error(`[${SOURCE}] Erro ao atualizar campaign_message_events:`, error);
    } else {
      console.log(`[${SOURCE}] Atualizado ${data?.length || 0} registro(s) para messageId ${messageId}`);
    }

    return new Response(JSON.stringify({ success: true, updated: data?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`[${SOURCE}] Fatal error:`, error);
    await saveLog(supabase, {
      source: SOURCE,
      level: "error",
      message: `Erro ao processar webhook SES: ${errorMessage}`,
      metadata: { error_detail: errorMessage },
    });
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
