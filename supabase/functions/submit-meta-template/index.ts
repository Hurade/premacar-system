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

    // Componente com variável ({{1}}, {{2}}...) sem um "example" junto é
    // recusado pela Meta com status REJECTED / rejected_reason
    // "INVALID_FORMAT" — descoberto reenviando manualmente um template que
    // caiu nesse erro mesmo depois de corrigir {{nome}} pra {{1}}: só
    // voltou a PENDING (review de verdade) depois de incluir o example.
    const FIELD_EXAMPLES: Record<string, string> = {
      name: "João Silva",
      company: "Auto Center Silva",
      city: "São Paulo",
      product: "Revisão",
      custom1: "Exemplo 1",
      custom2: "Exemplo 2",
      custom3: "Exemplo 3",
    };

    function extractPlaceholderIndexes(text: string): number[] {
      const matches = text.match(/\{\{(\d+)\}\}/g) || [];
      return [...new Set(matches.map((m) => parseInt(m.replace(/[{}]/g, ""), 10)))].sort((a, b) => a - b);
    }

    function buildExampleValues(text: string, mapping: Array<{ index: number; field: string }> | null): string[] | null {
      const indexes = extractPlaceholderIndexes(text);
      if (indexes.length === 0) return null;
      return indexes.map((i) => {
        const mappedField = mapping?.find((m) => m.index === i)?.field;
        return (mappedField && FIELD_EXAMPLES[mappedField]) || `Exemplo ${i}`;
      });
    }

    const components: Record<string, unknown>[] = [];
    if (template.header_text) {
      const headerComp: Record<string, unknown> = { type: "HEADER", format: "TEXT", text: template.header_text };
      const headerExample = buildExampleValues(template.header_text, template.parameters_mapping);
      if (headerExample) headerComp.example = { header_text: headerExample };
      components.push(headerComp);
    }

    const bodyComp: Record<string, unknown> = { type: "BODY", text: template.body_text };
    const bodyExample = buildExampleValues(template.body_text, template.parameters_mapping);
    if (bodyExample) bodyComp.example = { body_text: [bodyExample] };
    components.push(bodyComp);

    if (template.footer_text) {
      components.push({ type: "FOOTER", text: template.footer_text });
    }

    // Template que já tem meta_template_id (enviado antes, aprovado ou
    // rejeitado) precisa usar o endpoint de EDIÇÃO (POST /{template-id},
    // só components/category) — a Meta recusa criar de novo com o mesmo
    // nome+idioma ("Já existe conteúdo nesse idioma"), mesmo que a versão
    // anterior tenha sido rejeitada. Criar (POST na WABA, com name+language)
    // só vale pra quem nunca foi enviado.
    const isResubmit = !!template.meta_template_id;
    const url = isResubmit
      ? `https://graph.facebook.com/v21.0/${template.meta_template_id}`
      : `https://graph.facebook.com/v21.0/${settings.meta_business_account_id}/message_templates`;
    const payload = isResubmit
      ? { category: template.category, components }
      : { name: template.name, category: template.category, language: template.language_code || "pt_BR", components };

    console.log(`[submit-meta-template] ${isResubmit ? 'Reenviando' : 'Enviando'} template "${template.name}":`, JSON.stringify(payload));

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

    // O endpoint de edição não devolve "status" no corpo (só confirma que
    // aceitou os components) — editar sempre manda o template de volta pra
    // revisão, então o status correto é sempre "pending" nesse caso. Já o
    // endpoint de criação devolve o status real (quase sempre "PENDING").
    const metaStatus = isResubmit ? "pending" : (data.status || "PENDING").toLowerCase();

    await supabase
      .from("meta_templates")
      .update({
        meta_template_id: data.id || template.meta_template_id,
        status: metaStatus === "approved" || metaStatus === "rejected" ? metaStatus : "pending",
        submission_error: null,
      })
      .eq("id", templateId);

    return new Response(
      JSON.stringify({ success: true, metaTemplateId: data.id || template.meta_template_id, metaStatus: isResubmit ? "PENDING" : data.status, metaCategory: data.category }),
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
