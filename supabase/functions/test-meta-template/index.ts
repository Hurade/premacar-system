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

    const { templateId, phoneNumber, testParameters } = await req.json();

    if (!templateId) {
      throw new Error("templateId é obrigatório");
    }
    if (!phoneNumber) {
      throw new Error("phoneNumber é obrigatório");
    }

    console.log(`[test-meta-template] Testing template ${templateId} to ${phoneNumber}`);

    // Buscar template
    const { data: template, error: templateError } = await supabase
      .from("meta_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (templateError || !template) {
      throw new Error("Template não encontrado");
    }

    // Buscar configurações da Meta API
    const { data: settings } = await supabase
      .from("nina_settings")
      .select("meta_phone_number_id, meta_access_token, meta_api_enabled")
      .limit(1)
      .single();

    if (!settings?.meta_phone_number_id || !settings?.meta_access_token) {
      throw new Error("Meta API não configurada. Configure na aba de APIs.");
    }

    // Formatar número
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    console.log(`[test-meta-template] Sending to ${formattedPhone}`);
    console.log(`[test-meta-template] Template: ${template.name}`);

    // Preparar parâmetros
    const parameters: { type: string; text: string }[] = [];
    
    if (template.parameters_count > 0) {
      const defaultParams = testParameters || [];
      for (let i = 0; i < template.parameters_count; i++) {
        parameters.push({
          type: 'text',
          text: defaultParams[i] || `Teste ${i + 1}`
        });
      }
    }

    // Construir payload
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formattedPhone,
      type: 'template',
      template: {
        name: template.name,
        language: {
          code: template.language_code || 'pt_BR'
        },
        components: parameters.length > 0 ? [
          {
            type: 'body',
            parameters: parameters
          }
        ] : []
      }
    };

    console.log(`[test-meta-template] Payload:`, JSON.stringify(payload, null, 2));

    // Enviar via Meta API
    const url = `https://graph.facebook.com/v21.0/${settings.meta_phone_number_id}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.meta_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[test-meta-template] Erro:', data);
      throw new Error(data.error?.message || 'Erro ao enviar template');
    }

    console.log('[test-meta-template] Sucesso:', data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Template de teste enviado com sucesso!',
        messageId: data.messages?.[0]?.id,
        templateName: template.name,
        recipient: formattedPhone
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("[test-meta-template] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});