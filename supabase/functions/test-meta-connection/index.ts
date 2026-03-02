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

    // Buscar configurações
    const { data: settings } = await supabase
      .from("nina_settings")
      .select("meta_phone_number_id, meta_access_token, meta_api_enabled, meta_business_account_id")
      .limit(1)
      .single();

    if (!settings) {
      throw new Error("Configurações não encontradas");
    }

    const results: Record<string, unknown> = {
      meta_api_enabled: settings.meta_api_enabled,
      phone_number_id: settings.meta_phone_number_id,
      business_account_id: settings.meta_business_account_id,
      has_access_token: !!settings.meta_access_token,
    };

    // Test 1: Validate phone number ID
    console.log("[test-meta] Testing phone number ID...");
    const phoneRes = await fetch(
      `https://graph.facebook.com/v21.0/${settings.meta_phone_number_id}?fields=verified_name,quality_rating,messaging_limit_tier,display_phone_number,name_status`,
      { headers: { Authorization: `Bearer ${settings.meta_access_token}` } }
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

    // Test 2: Check WABA health
    console.log("[test-meta] Testing WABA...");
    const wabaRes = await fetch(
      `https://graph.facebook.com/v21.0/${settings.meta_business_account_id}?fields=name,message_template_namespace,account_review_status`,
      { headers: { Authorization: `Bearer ${settings.meta_access_token}` } }
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
      `https://graph.facebook.com/v21.0/${settings.meta_business_account_id}/message_templates?fields=name,status,language&limit=10`,
      { headers: { Authorization: `Bearer ${settings.meta_access_token}` } }
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

    const allPassed = results.phone_test && (results.phone_test as Record<string, unknown>).success && 
                      results.waba_test && (results.waba_test as Record<string, unknown>).success;

    console.log("[test-meta] Results:", JSON.stringify(results, null, 2));

    return new Response(
      JSON.stringify({ success: allPassed, results }),
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
