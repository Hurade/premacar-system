import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { saveLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE = "conversation-archiver";

// Arquiva (is_active=false) conversas em modo IA (status='nina') sem
// nenhuma mensagem nova há mais de ABANDON_DAYS — sem isso, "Atendimentos
// Abertos" só cresce pra sempre, já que não existe nenhum outro jeito de
// uma conversa sair desse estado quando o cliente simplesmente some.
// Não mexe em 'human'/'paused': encerrar essas é decisão de quem está
// atendendo, não automática.
const ABANDON_DAYS = 7;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const threshold = new Date(Date.now() - ABANDON_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("conversations")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("is_active", true)
      .eq("status", "nina")
      .lt("last_message_at", threshold)
      .select("id");

    if (error) throw error;

    const archivedCount = data?.length || 0;
    console.log(`[${SOURCE}] Archived ${archivedCount} abandoned conversations (>${ABANDON_DAYS}d, status=nina)`);

    if (archivedCount > 0) {
      await saveLog(supabase, {
        source: SOURCE,
        level: "info",
        message: `${archivedCount} conversa(s) arquivada(s) por abandono (sem mensagem há mais de ${ABANDON_DAYS} dias, modo IA)`,
        metadata: { archived_count: archivedCount, threshold_days: ABANDON_DAYS },
      });
    }

    return new Response(JSON.stringify({ success: true, archived: archivedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    console.error(`[${SOURCE}] Fatal error:`, error);
    await saveLog(supabase, {
      source: SOURCE,
      level: "error",
      message: `Erro ao arquivar conversas abandonadas: ${errorMessage}`,
      metadata: { error_detail: errorMessage },
    });
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
