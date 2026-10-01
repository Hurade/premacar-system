import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TAG = "[CheckMetaTemplateStatus]";

// A Meta não avisa quando aprova/rejeita um template (sem webhook pra isso)
// — só dá pra saber perguntando. Roda via pg_cron periodicamente, consulta
// o status real de cada template local ainda "pending" e atualiza aqui
// sozinho, sem precisar de alguém clicar em "Aprovar" manualmente.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: pendingTemplates, error: fetchError } = await supabase
      .from("meta_templates")
      .select("id, name, meta_template_id")
      .eq("status", "pending")
      .not("meta_template_id", "is", null);

    if (fetchError) throw fetchError;

    if (!pendingTemplates || pendingTemplates.length === 0) {
      return new Response(JSON.stringify({ success: true, checked: 0, updated: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("nina_settings")
      .select("meta_access_token")
      .limit(1)
      .maybeSingle();

    if (!settings?.meta_access_token) {
      console.error(`${TAG} Meta API não configurada (sem access token)`);
      return new Response(JSON.stringify({ success: false, error: "Meta API não configurada" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let checked = 0;
    let updated = 0;

    for (const template of pendingTemplates) {
      checked++;
      try {
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${template.meta_template_id}?fields=status,rejected_reason`,
          { headers: { Authorization: `Bearer ${settings.meta_access_token}` } }
        );
        const data = await response.json();

        if (!response.ok) {
          console.error(`${TAG} Erro consultando template "${template.name}":`, data?.error?.message || data);
          continue;
        }

        const metaStatus = (data.status || "").toLowerCase();
        if (metaStatus !== "approved" && metaStatus !== "rejected") {
          continue; // ainda pending de verdade, nada a fazer
        }

        const updatePayload: Record<string, unknown> = { status: metaStatus };
        if (metaStatus === "approved") {
          updatePayload.approved_at = new Date().toISOString();
          updatePayload.rejected_reason = null;
        } else {
          updatePayload.rejected_reason = data.rejected_reason || null;
        }

        const { error: updateError } = await supabase
          .from("meta_templates")
          .update(updatePayload)
          .eq("id", template.id);

        if (updateError) {
          console.error(`${TAG} Erro ao atualizar template "${template.name}":`, updateError.message);
          continue;
        }

        updated++;
        console.log(`${TAG} Template "${template.name}" atualizado: ${metaStatus}`);
      } catch (err) {
        console.error(`${TAG} Erro processando template "${template.name}":`, err instanceof Error ? err.message : err);
      }
    }

    return new Response(JSON.stringify({ success: true, checked, updated }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`${TAG} Erro fatal:`, err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
