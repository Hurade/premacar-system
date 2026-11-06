import { SendCredentials } from "./connection-resolver.ts";

// Extraído de recurring-campaign-processor/index.ts (sendWhatsApp) para ser
// reaproveitado também pelo automation-delayed-processor — ambos precisam
// mandar WhatsApp direto pela API (Evolution/Meta) sem depender de uma
// conversation_id existente, ao contrário do caminho via send_queue.
export async function sendWhatsAppMessage(
  contact: any,
  params: { message?: string; templateId?: string | null },
  creds: SendCredentials,
  supabase: any
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const contactName = contact.name || contact.call_name || "Cliente";
  const message = (params.message || "")
    .replace(/\{\{nome\}\}/g, contactName)
    .replace(/\{\{empresa\}\}/g, contact.oficina || "");

  if (!contact.phone_number) {
    return { success: false, error: "Contato sem número de telefone" };
  }

  const cleanPhone = contact.phone_number.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

  const templateId = params.templateId || null;

  console.log(`[whatsapp-send] sendWhatsAppMessage: api_type=${creds.api_type}, phone=${formattedPhone}, templateId=${templateId || "none"}`);

  // ── Meta API ──────────────────────────────────────────────────────────────
  if (creds.api_type === "meta") {
    if (!creds.meta_access_token || !creds.meta_phone_number_id) {
      return { success: false, error: "Credenciais Meta incompletas (meta_access_token ou meta_phone_number_id ausente)" };
    }

    const url = `https://graph.facebook.com/v21.0/${creds.meta_phone_number_id}/messages`;
    let payload: any;

    if (templateId) {
      const { data: template } = await supabase
        .from("meta_templates")
        .select("name, language_code, parameters_count, parameters_mapping, status")
        .eq("id", templateId)
        .single();

      if (!template) {
        return { success: false, error: `Template ${templateId} não encontrado na tabela meta_templates. Verifique o cadastro em Configurações → Templates.` };
      }
      if (template.status !== "approved") {
        return { success: false, error: `Template "${template.name}" não aprovado pela Meta (status: ${template.status}). Aguarde aprovação ou escolha outro template.` };
      }

      console.log(`[whatsapp-send] Meta template "${template.name}" (${template.language_code}) → ${formattedPhone}`);

      const components: any[] = [];
      if (template.parameters_count > 0) {
        const mapping = (template.parameters_mapping as Array<{ index: number; field: string }>) || [];
        const paramsArr: any[] = [];
        for (let i = 1; i <= template.parameters_count; i++) {
          const paramKey = mapping.find((m) => m.index === i)?.field || "";
          let value = contactName;
          if (paramKey === "empresa" || paramKey === "company") value = contact.oficina || "sua empresa";
          else if (paramKey === "telefone" || paramKey === "phone") value = contact.phone_number;
          paramsArr.push({ type: "text", text: value });
        }
        components.push({ type: "body", parameters: paramsArr });
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
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { body: message },
      };
    } else {
      return { success: false, error: "Nenhum template ou mensagem configurado para este envio" };
    }

    console.log(`[whatsapp-send] Meta payload:`, JSON.stringify(payload).substring(0, 500));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.meta_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (response.ok) {
      const metaMessageId = data.messages?.[0]?.id;
      console.log(`[whatsapp-send] Meta API success, message ID:`, metaMessageId);
      return { success: true, messageId: metaMessageId };
    }

    const errMsg = data.error?.message || JSON.stringify(data.error) || "Meta API error";
    console.error(`[whatsapp-send] Meta API erro (${response.status}): ${errMsg}`);
    return { success: false, error: `Meta API ${response.status}: ${errMsg}` };
  }

  // ── Evolution API ─────────────────────────────────────────────────────────
  if (creds.api_type === "evolution") {
    if (!creds.evolution_api_url || !creds.evolution_api_key || !creds.evolution_instance_name) {
      return { success: false, error: "Credenciais Evolution incompletas (URL, API key ou instância ausente)" };
    }
    if (!message) {
      return { success: false, error: "Evolution API requer mensagem de texto (configure uma mensagem para este envio)" };
    }

    const evolutionUrl = `${creds.evolution_api_url.replace(/\/$/, "")}/message/sendText/${creds.evolution_instance_name}`;
    console.log(`[whatsapp-send] Evolution API: ${evolutionUrl}, phone: ${formattedPhone}`);

    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: creds.evolution_api_key },
      body: JSON.stringify({ number: formattedPhone, text: message }),
    });

    const respData = await response.json().catch(() => ({}));
    console.log(`[whatsapp-send] Evolution response ${response.status}:`, JSON.stringify(respData).substring(0, 400));

    if (!response.ok) {
      return { success: false, error: respData.message || respData.error || `Evolution API error ${response.status}` };
    }
    if (!respData?.key?.id && !respData?.messageId) {
      const errDetail = respData?.message || respData?.error || respData?.status || JSON.stringify(respData).substring(0, 150);
      console.error(`[whatsapp-send] Evolution HTTP 200 sem key.id — erro silencioso:`, errDetail);
      return { success: false, error: `Evolution API: mensagem não enfileirada — ${errDetail}` };
    }

    const evolutionMessageId = respData.key?.id || respData.messageId;
    console.log(`[whatsapp-send] Evolution success, key.id:`, evolutionMessageId);
    return { success: true, messageId: evolutionMessageId };
  }

  return { success: false, error: "api_type desconhecido nas credenciais WhatsApp" };
}
