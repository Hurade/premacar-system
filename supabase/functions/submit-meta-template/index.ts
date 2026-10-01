import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Envia um template recém-cadastrado localmente pra aprovação de verdade da
// Meta (POST na Graph API, nível da WABA — diferente do envio de mensagem,
// que é no nível do phone_number_id). Antes disso, "cadastrar template"
// só criava o espelho local e o usuário tinha que aprovar manualmente,
// assumindo que já tinha feito esse cadastro por fora, no Meta Business
// Suite.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { templateId } = await req.json();
    if (!templateId) {
      throw new Error("templateId é obrigatório");
    }

    const { data: template, error: templateError } = await supabase
      .from("meta_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      throw new Error("Template não encontrado");
    }

    const { data: settings } = await supabase
      .from("nina_settings")
      .select("meta_business_account_id, meta_access_token")
      .limit(1)
      .single();

    if (!settings?.meta_business_account_id || !settings?.meta_access_token) {
      throw new Error("Meta API não configurada (falta WhatsApp Business Account ID ou access token). Configure na aba de APIs.");
    }

    const components: Record<string, unknown>[] = [];
    if (template.header_text) {
      components.push({ type: "HEADER", format: "TEXT", text: template.header_text });
    }
    components.push({ type: "BODY", text: template.body_text });
    if (template.footer_text) {
      components.push({ type: "FOOTER", text: template.footer_text });
    }

    const payload = {
      name: template.name,
      category: template.category,
      language: template.language_code || "pt_BR",
      components,
    };

    console.log(`[submit-meta-template] Enviando template "${template.name}" para a WABA ${settings.meta_business_account_id}:`, JSON.stringify(payload));

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${settings.meta_business_account_id}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${settings.meta_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data?.error?.error_user_msg || data?.error?.message || "Erro desconhecido ao enviar template para a Meta";
      console.error("[submit-meta-template] Meta recusou o envio:", data);

      await supabase
        .from("meta_templates")
        .update({ submission_error: errorMessage })
        .eq("id", templateId);

      return new Response(
        JSON.stringify({ success: false, error: errorMessage, metaResponse: data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[submit-meta-template] Meta aceitou o envio:", data);

    // Meta responde com status "PENDING" (quase sempre) logo após o envio —
    // a aprovação de verdade (ou rejeição) acontece depois, de forma
    // assíncrona, só visível de novo consultando o template na Meta.
    const metaStatus = (data.status || "PENDING").toLowerCase();

    await supabase
      .from("meta_templates")
      .update({
        meta_template_id: data.id,
        status: metaStatus === "approved" || metaStatus === "rejected" ? metaStatus : "pending",
        submission_error: null,
      })
      .eq("id", templateId);

    return new Response(
      JSON.stringify({ success: true, metaTemplateId: data.id, metaStatus: data.status, metaCategory: data.category }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[submit-meta-template] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
