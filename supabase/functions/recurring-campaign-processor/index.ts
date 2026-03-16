import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional: process specific campaign
    let targetCampaignId: string | null = null;
    try {
      const body = await req.json();
      targetCampaignId = body.campaign_id || null;
    } catch { /* no body */ }

    console.log("[recurring-processor] Starting...", targetCampaignId ? `Campaign: ${targetCampaignId}` : "All active");

    // Get active recurring campaigns
    let query = supabase
      .from("recurring_campaigns")
      .select("*")
      .eq("status", "active");

    if (targetCampaignId) {
      query = query.eq("id", targetCampaignId);
    }

    const { data: campaigns, error: campaignsError } = await query;
    if (campaignsError) throw campaignsError;

    console.log(`[recurring-processor] Found ${campaigns?.length || 0} campaigns`);

    // Get nina settings for WhatsApp configs
    const { data: ninaSettings } = await supabase
      .from("nina_settings")
      .select("evolution_api_url, evolution_api_key, evolution_instance_name, meta_phone_number_id, meta_access_token, timezone")
      .limit(1)
      .single();

    // Get integration settings for email configs
    const { data: integrationSettings } = await supabase
      .from("integration_settings")
      .select("aws_access_key_id, aws_secret_access_key, aws_region, aws_ses_email_from, aws_ses_email_from_name, aws_ses_enabled")
      .limit(1)
      .single();

    const results: any[] = [];

    for (const campaign of campaigns || []) {
      const flowConfig = campaign.flow_config as Record<string, any>;
      
      // Get in_progress contacts for this campaign
      const { data: contacts, error: contactsError } = await supabase
        .from("campaign_contacts")
        .select("id, contact_id, current_day, status, day_statuses, metadata")
        .eq("campaign_id", campaign.id)
        .eq("status", "in_progress");

      if (contactsError) {
        console.error(`[recurring-processor] Error fetching contacts:`, contactsError);
        continue;
      }

      if (!contacts || contacts.length === 0) {
        console.log(`[recurring-processor] No in_progress contacts for campaign ${campaign.name}`);
        // Mark campaign completed if no contacts left
        await supabase
          .from("recurring_campaigns")
          .update({ status: "completed", ended_at: new Date().toISOString() })
          .eq("id", campaign.id);
        continue;
      }

      console.log(`[recurring-processor] Processing ${contacts.length} contacts for "${campaign.name}"`);

      let sentCount = 0;
      let failedCount = 0;

      for (const cc of contacts) {
        const dayKey = `day${cc.current_day}`;
        const dayConfig = flowConfig[dayKey];

        if (!dayConfig || !dayConfig.enabled) {
          console.log(`[recurring-processor] Day ${cc.current_day} not configured or disabled, skipping`);
          continue;
        }

        // Check if already processed today
        const dayStatuses = (cc.day_statuses as Record<string, any>) || {};
        if (dayStatuses[dayKey]?.sent_at) {
          console.log(`[recurring-processor] Day ${cc.current_day} already sent for contact ${cc.contact_id}`);
          continue;
        }

        // Get contact details
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, name, call_name, phone_number, email, oficina")
          .eq("id", cc.contact_id)
          .single();

        if (!contact) {
          console.error(`[recurring-processor] Contact not found: ${cc.contact_id}`);
          failedCount++;
          continue;
        }

        const contactName = contact.name || contact.call_name || "Cliente";
        let sendResult = { success: false, error: "" };

        try {
          if (dayConfig.type === "email") {
            sendResult = await sendEmail(contact, dayConfig, integrationSettings);
          } else if (dayConfig.type === "whatsapp") {
            sendResult = await sendWhatsApp(contact, dayConfig, ninaSettings);
          } else if (dayConfig.type === "sms") {
            // SMS not implemented yet
            sendResult = { success: false, error: "SMS não implementado ainda" };
          } else if (dayConfig.type === "call") {
            // Call not implemented yet
            sendResult = { success: false, error: "Ligação não implementada ainda" };
          } else {
            sendResult = { success: false, error: `Tipo desconhecido: ${dayConfig.type}` };
          }
        } catch (err: any) {
          sendResult = { success: false, error: err.message || "Erro desconhecido" };
        }

        // Update day status
        const updatedDayStatuses = {
          ...dayStatuses,
          [dayKey]: {
            sent_at: new Date().toISOString(),
            success: sendResult.success,
            error: sendResult.success ? null : sendResult.error,
            type: dayConfig.type,
          },
        };

        if (sendResult.success) {
          sentCount++;
          console.log(`[recurring-processor] ✅ Sent ${dayConfig.type} to ${contactName} (Day ${cc.current_day})`);

          // Check if this is the last day
          const nextDayKey = `day${cc.current_day + 1}`;
          const hasNextDay = flowConfig[nextDayKey] && flowConfig[nextDayKey].enabled;

          if (hasNextDay) {
            // Advance to next day
            await supabase
              .from("campaign_contacts")
              .update({
                current_day: cc.current_day + 1,
                day_statuses: updatedDayStatuses,
                updated_at: new Date().toISOString(),
              } as any)
              .eq("id", cc.id);
          } else {
            // Mark as success (completed all days)
            await supabase
              .from("campaign_contacts")
              .update({
                status: "success",
                day_statuses: updatedDayStatuses,
                success_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as any)
              .eq("id", cc.id);
          }
        } else {
          failedCount++;
          console.error(`[recurring-processor] ❌ Failed ${dayConfig.type} to ${contactName}: ${sendResult.error}`);

          await supabase
            .from("campaign_contacts")
            .update({
              status: "failed",
              day_statuses: updatedDayStatuses,
              failed_reason: sendResult.error,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", cc.id);
        }
      }

      // Update campaign counters
      await supabase
        .from("recurring_campaigns")
        .update({
          success_count: (campaign.success_count || 0) + sentCount,
          failed_count: (campaign.failed_count || 0) + failedCount,
          in_progress_count: Math.max(0, (campaign.in_progress_count || 0) - sentCount - failedCount),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", campaign.id);

      results.push({
        campaign_id: campaign.id,
        name: campaign.name,
        sent: sentCount,
        failed: failedCount,
      });
    }

    console.log("[recurring-processor] Done:", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[recurring-processor] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===== Email via AWS SES =====
async function sendEmail(
  contact: any,
  dayConfig: any,
  settings: any
): Promise<{ success: boolean; error?: string }> {
  if (!settings?.aws_ses_enabled) {
    return { success: false, error: "AWS SES não está habilitado" };
  }
  if (!contact.email) {
    return { success: false, error: "Contato sem email" };
  }

  const config = dayConfig.config || {};
  const subject = (config.subject || "Campanha")
    .replace(/\{\{nome\}\}/g, contact.name || contact.call_name || "Cliente")
    .replace(/\{\{empresa\}\}/g, contact.oficina || "");

  let body = (config.html_body || config.message || "")
    .replace(/\{\{nome\}\}/g, contact.name || contact.call_name || "Cliente")
    .replace(/\{\{empresa\}\}/g, contact.oficina || "");

  // If body doesn't contain HTML tags, wrap in basic HTML
  if (!body.includes("<")) {
    body = `<html><body><p>${body.replace(/\n/g, "<br>")}</p></body></html>`;
  }

  const region = settings.aws_region || "us-east-1";
  const accessKeyId = settings.aws_access_key_id;
  const secretAccessKey = settings.aws_secret_access_key;
  const fromEmail = settings.aws_ses_email_from;
  const fromName = settings.aws_ses_email_from_name || "PremaCar";

  if (!accessKeyId || !secretAccessKey || !fromEmail) {
    return { success: false, error: "Credenciais AWS SES incompletas" };
  }

  try {
    // Use AWS SES SendEmail API v2 via REST
    const host = `email.${region}.amazonaws.com`;
    const endpoint = `https://${host}/v2/email/outbound-emails`;

    const payload = {
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: body, Charset: "UTF-8" },
          },
        },
      },
      Destination: {
        ToAddresses: [contact.email],
      },
      FromEmailAddress: `${fromName} <${fromEmail}>`,
    };

    // Sign request with AWS Signature V4
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    const encoder = new TextEncoder();

    async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key instanceof Uint8Array ? key : new Uint8Array(key),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
    }

    async function sha256(data: string): Promise<string> {
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    const payloadStr = JSON.stringify(payload);
    const payloadHash = await sha256(payloadStr);

    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-date";
    const canonicalRequest = `POST\n/v2/email/outbound-emails\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

    const kDate = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, "ses");
    const kSigning = await hmac(kService, "aws4_request");
    const signatureBuffer = await hmac(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Amz-Date": amzDate,
        Authorization: authorizationHeader,
      },
      body: payloadStr,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[recurring-processor] SES error:", errorText);
      return { success: false, error: `SES Error ${response.status}: ${errorText.substring(0, 200)}` };
    }

    console.log("[recurring-processor] Email sent to:", contact.email);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ===== WhatsApp via Meta or Evolution =====
async function sendWhatsApp(
  contact: any,
  dayConfig: any,
  settings: any,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  const config = dayConfig.config || {};
  const contactName = contact.name || contact.call_name || "Cliente";
  const message = (config.message || "")
    .replace(/\{\{nome\}\}/g, contactName)
    .replace(/\{\{empresa\}\}/g, contact.oficina || "");

  const cleanPhone = contact.phone_number.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

  // Try Meta API first if configured
  if (settings?.meta_access_token && settings?.meta_phone_number_id) {
    try {
      const url = `https://graph.facebook.com/v21.0/${settings.meta_phone_number_id}/messages`;
      let payload: any;

      // If template_id is set, send as template (required outside 24h window)
      if (config.template_id) {
        // Fetch template details from meta_templates
        const { data: template } = await supabase
          .from("meta_templates")
          .select("name, language_code, parameters_count, parameters_mapping")
          .eq("id", config.template_id)
          .single();

        if (!template) {
          return { success: false, error: `Template ${config.template_id} não encontrado` };
        }

        console.log(`[recurring-processor] Sending template "${template.name}" (${template.language_code}) to ${formattedPhone}`);

        // Build template parameters
        const components: any[] = [];
        if (template.parameters_count > 0) {
          const params: any[] = [];
          const mapping = (template.parameters_mapping as Record<string, string>) || {};
          
          for (let i = 1; i <= template.parameters_count; i++) {
            const paramKey = mapping[`${i}`] || mapping[String(i)] || "";
            let value = contactName; // default
            
            if (paramKey === "nome" || paramKey === "name" || paramKey === "1") {
              value = contactName;
            } else if (paramKey === "empresa" || paramKey === "company") {
              value = contact.oficina || "sua empresa";
            } else if (paramKey === "telefone" || paramKey === "phone") {
              value = contact.phone_number;
            }
            
            params.push({ type: "text", text: value });
          }
          
          components.push({ type: "body", parameters: params });
        }

        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "template",
          template: {
            name: template.name,
            language: { code: template.language_code },
            ...(components.length > 0 ? { components } : {}),
          },
        };
      } else if (message) {
        // Send as plain text (only works within 24h window)
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: formattedPhone,
          type: "text",
          text: { body: message },
        };
      } else {
        return { success: false, error: "Mensagem vazia e sem template selecionado" };
      }

      console.log(`[recurring-processor] Meta payload:`, JSON.stringify(payload).substring(0, 500));

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.meta_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        const errMsg = data.error?.message || JSON.stringify(data.error) || "Meta API error";
        console.error(`[recurring-processor] Meta API error:`, JSON.stringify(data));
        return { success: false, error: errMsg };
      }

      console.log(`[recurring-processor] Meta API success, message ID:`, data.messages?.[0]?.id);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // Fallback to Evolution API
  if (settings?.evolution_api_url && settings?.evolution_api_key && settings?.evolution_instance_name) {
    if (!message) {
      return { success: false, error: "Evolution API requer mensagem de texto" };
    }
    try {
      const evolutionUrl = `${settings.evolution_api_url}/message/sendText/${settings.evolution_instance_name}`;
      const response = await fetch(evolutionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: settings.evolution_api_key,
        },
        body: JSON.stringify({ number: formattedPhone, text: message }),
      });

      if (!response.ok) {
        const errData = await response.json();
        return { success: false, error: errData.message || "Evolution API error" };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  return { success: false, error: "Nenhuma API WhatsApp configurada" };
}
