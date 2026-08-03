import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { saveLog } from "../_shared/logger.ts";
import { resolveSendCredentials, SendCredentials } from "../_shared/connection-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE = "followup-processor";

interface FollowupSettings {
  id: string;
  user_id: string;
  is_active: boolean;
  message: string;
  delay_hours: number;
  tag_name: string;
}

interface EligibleConversation {
  id: string;
  contact_id: string;
  connection_id: string | null;
  api_source: string;
  window_expires_at: string;
  last_customer_message_at: string;
}

interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  tags: string[] | null;
  is_blocked: boolean | null;
}

// ── Meta WhatsApp Business API ────────────────────────────────────────────────
async function sendTextViaMeta(
  phoneNumber: string,
  message: string,
  metaPhoneNumberId: string,
  metaAccessToken: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${metaPhoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { body: message },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error?.message || `Meta HTTP ${response.status}` };
    }
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Evolution API ─────────────────────────────────────────────────────────────
async function sendTextViaEvolution(
  phoneNumber: string,
  message: string,
  evolutionApiUrl: string,
  evolutionApiKey: string,
  evolutionInstanceName: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const baseUrl = evolutionApiUrl.replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/message/sendText/${evolutionInstanceName}`, {
      method: "POST",
      headers: { apikey: evolutionApiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: formattedPhone, text: message }),
    });

    const data = await response.json();

    // Evolution retorna HTTP 200 mesmo em erro — verifica pelo campo key.id
    const messageId = data?.key?.id || data?.messageId || null;
    if (!response.ok || (!messageId && data?.error)) {
      return { success: false, error: data?.error?.message || data?.message || `Evolution HTTP ${response.status}` };
    }
    return { success: true, messageId: messageId || undefined };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido" };
  }
}

// ── Resolve credenciais Evolution com fallback para conexão padrão ─────────────
// Se a conversa não tem connection_id: tenta is_default=true em whatsapp_connections,
// depois primeira ativa, e por último o fallback legado de nina_settings.
async function resolveEvolutionCredentials(supabase: any, connectionId: string | null): Promise<SendCredentials> {
  if (connectionId) {
    return resolveSendCredentials(supabase, { connectionId, apiSource: "evolution" });
  }

  // Sem connection_id: busca conexão padrão (is_default=true → primeira ativa)
  const { data: defaultConn } = await supabase
    .from("whatsapp_connections")
    .select("id")
    .eq("api_type", "evolution")
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return resolveSendCredentials(supabase, {
    connectionId: defaultConn?.id ?? null,
    apiSource: "evolution",
  });
}

// ── Handler principal ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log(`[${SOURCE}] Starting follow-up processing...`);

  const results: { conversationId: string; sent: boolean; reason?: string }[] = [];

  try {
    const { data: allSettings, error: settingsError } = await supabase
      .from("followup_settings")
      .select("*")
      .eq("is_active", true);

    if (settingsError) throw settingsError;

    if (!allSettings || allSettings.length === 0) {
      console.log(`[${SOURCE}] No active follow-up configurations found.`);
      return new Response(JSON.stringify({ success: true, processed: 0, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const windowSafetyThreshold = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    for (const settings of allSettings as FollowupSettings[]) {
      const delayThreshold = new Date(now.getTime() - settings.delay_hours * 60 * 60 * 1000).toISOString();

      console.log(
        `[${SOURCE}] Config user=${settings.user_id} delay=${settings.delay_hours}h tag="${settings.tag_name}"`,
      );

      // Busca todas conversas elegíveis — sem filtro de api_source
      // Critérios: janela aberta, cliente mandou msg há >= delay_hours, janela expira em > 30min
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id, contact_id, connection_id, api_source, window_expires_at, last_customer_message_at")
        .eq("window_status", "open")
        .not("last_customer_message_at", "is", null)
        .lte("last_customer_message_at", delayThreshold)
        .gt("window_expires_at", windowSafetyThreshold);

      if (convError) {
        console.error(`[${SOURCE}] Error fetching conversations:`, convError.message);
        continue;
      }

      if (!conversations || conversations.length === 0) {
        console.log(`[${SOURCE}] No eligible conversations.`);
        continue;
      }

      console.log(`[${SOURCE}] Found ${conversations.length} candidate conversations.`);

      for (const conv of conversations as EligibleConversation[]) {
        const apiSource = conv.api_source || "evolution";

        // Busca contato
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, phone_number, name, tags, is_blocked")
          .eq("id", conv.contact_id)
          .maybeSingle();

        if (!contact) {
          results.push({ conversationId: conv.id, sent: false, reason: "contact_not_found" });
          continue;
        }

        const contactData = contact as Contact;

        if (contactData.is_blocked) {
          results.push({ conversationId: conv.id, sent: false, reason: "contact_blocked" });
          continue;
        }

        const currentTags = contactData.tags || [];
        if (currentTags.includes(settings.tag_name)) {
          results.push({ conversationId: conv.id, sent: false, reason: "already_tagged" });
          continue;
        }

        console.log(`[${SOURCE}] Sending via ${apiSource} to ${contactData.phone_number} (conv=${conv.id})`);

        // ── Roteamento por api_source ────────────────────────────────────────
        let sendResult: { success: boolean; messageId?: string; error?: string };
        let usedApiSource = apiSource;

        if (apiSource === "meta" || apiSource === "meta_official") {
          // ── Meta API ───────────────────────────────────────────────────────
          let creds: SendCredentials;
          try {
            creds = await resolveSendCredentials(supabase, {
              connectionId: conv.connection_id ?? null,
              apiSource: "meta",
            });
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Meta API não configurada";
            console.error(`[${SOURCE}] Meta creds error conv=${conv.id}: ${msg}`);
            results.push({ conversationId: conv.id, sent: false, reason: "meta_not_configured" });
            continue;
          }

          sendResult = await sendTextViaMeta(
            contactData.phone_number,
            settings.message,
            creds.meta_phone_number_id!,
            creds.meta_access_token!,
          );
          usedApiSource = "meta";
        } else {
          // ── Evolution API ──────────────────────────────────────────────────
          let creds: SendCredentials;
          try {
            creds = await resolveEvolutionCredentials(supabase, conv.connection_id ?? null);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Evolution API não configurada";
            console.error(`[${SOURCE}] Evolution creds error conv=${conv.id}: ${msg}`);
            results.push({ conversationId: conv.id, sent: false, reason: "evolution_not_configured" });
            continue;
          }

          sendResult = await sendTextViaEvolution(
            contactData.phone_number,
            settings.message,
            creds.evolution_api_url!,
            creds.evolution_api_key!,
            creds.evolution_instance_name!,
          );
          usedApiSource = "evolution";
        }

        // ── Resultado do envio ───────────────────────────────────────────────
        if (!sendResult.success) {
          console.error(`[${SOURCE}] Failed ${usedApiSource} → ${contactData.phone_number}: ${sendResult.error}`);
          await saveLog(supabase, {
            source: SOURCE,
            level: "error",
            message: `Erro ao enviar follow-up (${usedApiSource}) para ${contactData.phone_number}: ${sendResult.error}`,
            metadata: {
              conversation_id: conv.id,
              contact_id: conv.contact_id,
              phone: contactData.phone_number,
              api_source: usedApiSource,
              error_detail: sendResult.error,
            },
          });
          results.push({ conversationId: conv.id, sent: false, reason: sendResult.error });
          continue;
        }

        // Salva mensagem no histórico da conversa
        await supabase.from("messages").insert({
          conversation_id: conv.id,
          content: settings.message,
          type: "text",
          from_type: "human",
          status: "sent",
          api_source: usedApiSource,
          sent_at: now.toISOString(),
          whatsapp_message_id: sendResult.messageId || null,
          metadata: {
            is_followup: true,
            followup_tag: settings.tag_name,
          },
        });

        // Adiciona tag ao contato (dedup guard)
        await supabase
          .from("contacts")
          .update({ tags: [...currentTags, settings.tag_name] })
          .eq("id", conv.contact_id);

        await saveLog(supabase, {
          source: SOURCE,
          level: "info",
          message: `Follow-up enviado (${usedApiSource}) para ${contactData.phone_number} (${contactData.name || "sem nome"})`,
          metadata: {
            conversation_id: conv.id,
            contact_id: conv.contact_id,
            phone: contactData.phone_number,
            contact_name: contactData.name,
            api_source: usedApiSource,
            tag_applied: settings.tag_name,
            hours_since_last_message: settings.delay_hours,
            message_id: sendResult.messageId,
          },
        });

        console.log(`[${SOURCE}] ✅ Follow-up sent (${usedApiSource}) to ${contactData.phone_number}`);
        results.push({ conversationId: conv.id, sent: true });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`[${SOURCE}] Fatal error:`, error);
    await saveLog(supabase, {
      source: SOURCE,
      level: "error",
      message: `Erro fatal no processamento de follow-ups: ${errorMessage}`,
      metadata: { error_detail: errorMessage },
    });
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
