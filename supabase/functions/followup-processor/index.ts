import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { saveLog } from "../_shared/logger.ts";

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
  window_expires_at: string;
  last_customer_message_at: string;
}

interface Contact {
  id: string;
  phone_number: string;
  name: string | null;
  tags: string[] | null;
}

// Send a plain text message via Meta WhatsApp Business API
async function sendTextViaMeta(
  phoneNumber: string,
  message: string,
  metaPhoneNumberId: string,
  metaAccessToken: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const cleanPhone = phoneNumber.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

  const url = `https://graph.facebook.com/v18.0/${metaPhoneNumberId}/messages`;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "text",
    text: { body: message },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${metaAccessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error?.message || "Meta API error" };
    }

    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return { success: false, error: errorMessage };
  }
}

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
    // Fetch all active follow-up configurations
    const { data: allSettings, error: settingsError } = await supabase
      .from("followup_settings")
      .select("*")
      .eq("is_active", true);

    if (settingsError) throw settingsError;

    if (!allSettings || allSettings.length === 0) {
      console.log(`[${SOURCE}] No active follow-up configurations found.`);
      return new Response(
        JSON.stringify({ success: true, processed: 0, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch Meta API credentials (company-wide)
    const { data: ninaSettings } = await supabase
      .from("nina_settings")
      .select("meta_phone_number_id, meta_access_token, meta_api_enabled")
      .eq("meta_api_enabled", true)
      .limit(1)
      .maybeSingle();

    if (!ninaSettings?.meta_phone_number_id || !ninaSettings?.meta_access_token) {
      console.error(`[${SOURCE}] Meta API not configured or disabled.`);
      await saveLog(supabase, {
        source: SOURCE,
        level: "error",
        message: "Meta API não configurada ou desativada — follow-up não processado",
      });
      return new Response(
        JSON.stringify({ success: false, error: "Meta API not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const now = new Date();
    // Safety: ensure at least 30 minutes remain in the window before sending
    const windowSafetyThreshold = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    for (const settings of allSettings as FollowupSettings[]) {
      const delayThreshold = new Date(
        now.getTime() - settings.delay_hours * 60 * 60 * 1000
      ).toISOString();

      console.log(
        `[${SOURCE}] Processing config for user ${settings.user_id} — delay: ${settings.delay_hours}h, tag: "${settings.tag_name}"`
      );

      // Fetch eligible conversations:
      // - Meta API, window open
      // - Customer last messaged >= delay_hours ago
      // - Window expires in > 30 min (safe to send)
      // - has a customer message (last_customer_message_at not null)
      const { data: conversations, error: convError } = await supabase
        .from("conversations")
        .select("id, contact_id, window_expires_at, last_customer_message_at")
        .eq("api_source", "meta")
        .eq("window_status", "open")
        .not("last_customer_message_at", "is", null)
        .lte("last_customer_message_at", delayThreshold)
        .gt("window_expires_at", windowSafetyThreshold);

      if (convError) {
        console.error(`[${SOURCE}] Error fetching conversations:`, convError.message);
        continue;
      }

      if (!conversations || conversations.length === 0) {
        console.log(`[${SOURCE}] No eligible conversations for this configuration.`);
        continue;
      }

      console.log(`[${SOURCE}] Found ${conversations.length} candidate conversations.`);

      for (const conv of conversations as EligibleConversation[]) {
        // Fetch contact to check tags and phone
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, phone_number, name, tags")
          .eq("id", conv.contact_id)
          .maybeSingle();

        if (!contact) {
          console.log(`[${SOURCE}] Contact not found for conversation ${conv.id} — skipping.`);
          results.push({ conversationId: conv.id, sent: false, reason: "contact_not_found" });
          continue;
        }

        const contactData = contact as Contact;
        const currentTags = contactData.tags || [];

        // Skip if contact already received a follow-up in this cycle
        if (currentTags.includes(settings.tag_name)) {
          console.log(
            `[${SOURCE}] Contact ${contactData.phone_number} already has tag "${settings.tag_name}" — skipping.`
          );
          results.push({ conversationId: conv.id, sent: false, reason: "already_tagged" });
          continue;
        }

        console.log(
          `[${SOURCE}] Sending follow-up to ${contactData.phone_number} (conv: ${conv.id})`
        );

        // Send message via Meta API
        const sendResult = await sendTextViaMeta(
          contactData.phone_number,
          settings.message,
          ninaSettings.meta_phone_number_id,
          ninaSettings.meta_access_token
        );

        if (!sendResult.success) {
          console.error(
            `[${SOURCE}] Failed to send to ${contactData.phone_number}: ${sendResult.error}`
          );
          await saveLog(supabase, {
            source: SOURCE,
            level: "error",
            message: `Erro ao enviar follow-up para ${contactData.phone_number}: ${sendResult.error}`,
            metadata: {
              conversation_id: conv.id,
              contact_id: conv.contact_id,
              phone: contactData.phone_number,
              error_detail: sendResult.error,
            },
          });
          results.push({ conversationId: conv.id, sent: false, reason: sendResult.error });
          continue;
        }

        // Save message to conversation history
        await supabase.from("messages").insert({
          conversation_id: conv.id,
          content: settings.message,
          type: "text",
          from_type: "human",
          status: "sent",
          api_source: "meta",
          sent_at: now.toISOString(),
          whatsapp_message_id: sendResult.messageId || null,
          metadata: {
            is_followup: true,
            followup_tag: settings.tag_name,
          },
        });

        // Tag contact to prevent duplicate follow-ups this cycle
        await supabase
          .from("contacts")
          .update({ tags: [...currentTags, settings.tag_name] })
          .eq("id", conv.contact_id);

        await saveLog(supabase, {
          source: SOURCE,
          level: "info",
          message: `Follow-up enviado para ${contactData.phone_number} (${contactData.name || "sem nome"})`,
          metadata: {
            conversation_id: conv.id,
            contact_id: conv.contact_id,
            phone: contactData.phone_number,
            contact_name: contactData.name,
            tag_applied: settings.tag_name,
            hours_since_last_message: settings.delay_hours,
            message_id: sendResult.messageId,
          },
        });

        console.log(`[${SOURCE}] Follow-up sent successfully to ${contactData.phone_number}`);
        results.push({ conversationId: conv.id, sent: true });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`[${SOURCE}] Fatal error:`, error);
    await saveLog(supabase, {
      source: SOURCE,
      level: "error",
      message: `Erro fatal no processamento de follow-ups: ${errorMessage}`,
      metadata: { error_detail: errorMessage },
    });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
