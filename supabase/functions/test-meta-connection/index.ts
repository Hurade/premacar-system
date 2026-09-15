import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { response: authError } = await requireAdmin(req, corsHeaders);
  if (authError) return authError;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Credenciais da conexão específica sendo testada (enviadas pelo
    // frontend em useWhatsAppConnections.testConnection). Antes esta função
    // ignorava isso e sempre lia a config legada única em nina_settings —
    // então testava o número errado quando havia mais de uma conexão Meta,
    // ou nenhuma config caso nina_settings estivesse vazia.
    const body = await req.json().catch(() => ({}));
    let phoneNumberId = body?.phone_number_id;
    let accessToken = body?.access_token;
    let businessAccountId = body?.business_account_id;

    if (!phoneNumberId || !accessToken) {
      const { data: settings } = await supabase
        .from("nina_settings")
        .select("meta_phone_number_id, meta_access_token, meta_api_enabled, meta_business_account_id")
        .limit(1)
        .single();
      phoneNumberId = phoneNumberId || settings?.meta_phone_number_id;
      accessToken = accessToken || settings?.meta_access_token;
      businessAccountId = businessAccountId || settings?.meta_business_account_id;
    }

    if (!phoneNumberId || !accessToken) {
      throw new Error("phone_number_id e access_token são obrigatórios");
    }

    const results: Record<string, unknown> = {
      phone_number_id: phoneNumberId,
      business_account_id: businessAccountId,
      has_access_token: !!accessToken,
    };

    // Test 1: Validate phone number ID
    console.log("[test-meta] Testing phone number ID...");
    const phoneRes = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=verified_name,quality_rating,messaging_limit_tier,display_phone_number,name_status`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const phoneData = await phoneRes.json();

    if (phoneRes.ok) {
      results.phone_test = {
        success: true,
        verified_name: phoneData.verified_name,
        display_phone_number: phoneData.display_phone_number,
        quality_rating: phoneData.quality_rating,
        messaging_limit_tier: phoneData.messaging_limit_tier,
        name_status: phoneData.name_status,
      };
    } else {
      results.phone_test = { success: false, error: phoneData.error };
    }

    // Test 2 e 3 (WABA/templates) dependem do Business Account ID, que é
    // opcional na conexão — sem ele, pulamos em vez de forçar falha.
    if (businessAccountId) {
      console.log("[test-meta] Testing WABA...");
      const wabaRes = await fetch(
        `https://graph.facebook.com/v21.0/${businessAccountId}?fields=name,message_template_namespace,account_review_status`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const wabaData = await wabaRes.json();

      if (wabaRes.ok) {
        results.waba_test = {
          success: true,
          name: wabaData.name,
          namespace: wabaData.message_template_namespace,
          review_status: wabaData.account_review_status,
        };
      } else {
        results.waba_test = { success: false, error: wabaData.error };
      }

      // Test 3: List message templates from Meta
      console.log("[test-meta] Fetching templates from Meta...");
      const tplRes = await fetch(
        `https://graph.facebook.com/v21.0/${businessAccountId}/message_templates?fields=name,status,language&limit=10`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const tplData = await tplRes.json();

      if (tplRes.ok) {
        results.templates_test = {
          success: true,
          count: tplData.data?.length || 0,
          templates: tplData.data?.map((t: { name: string; status: string; language: string }) => ({
            name: t.name,
            status: t.status,
            language: t.language,
          })),
        };
      } else {
        results.templates_test = { success: false, error: tplData.error };
      }
    } else {
      results.waba_test = { skipped: true, reason: 'business_account_id não configurado' };
    }

    const phoneOk = !!(results.phone_test && (results.phone_test as Record<string, unknown>).success);
    const wabaOk = !businessAccountId || !!(results.waba_test && (results.waba_test as Record<string, unknown>).success);
    const allPassed = phoneOk && wabaOk;

    console.log("[test-meta] Results:", JSON.stringify(results, null, 2));

    // is_connected/connected: campos que o frontend (useWhatsAppConnections.
    // testConnection) realmente lê — antes só devolvíamos "success" e a UI
    // sempre mostrava "Desconectado", mesmo com o teste passando 100%.
    return new Response(
      JSON.stringify({ success: allPassed, is_connected: allPassed, connected: allPassed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("[test-meta] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
