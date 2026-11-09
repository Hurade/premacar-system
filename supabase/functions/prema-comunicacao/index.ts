import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveSendCredentials } from "../_shared/connection-resolver.ts";
import { sendWhatsAppMessage } from "../_shared/whatsapp-send.ts";
import { saveLog } from "../_shared/logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE = "prema-comunicacao";

// Conexão Evolution já conectada da Prema (+55 48 9994-1208) — único
// remetente desta API, fixo por design (§3.1 "Um remetente").
const PREMA_CONNECTION_ID = "a7bc0002-1365-4d5f-a075-9ca5e88ed477";

// Janela de dedupe (em horas) por tipo[+tópico], direto da tabela §3.2.b/c
// do pedido. Tipo sem entrada aqui nunca é deduplicado (sempre envia).
const DEDUPE_WINDOWS_HOURS: Record<string, number> = {
  "auto_PA:novo_detrator": 24,
  "auto_PA:pediu_atendimento": 24,
  "auto_PA:sem_creditos": 24 * 7,
  "auto_PA:pausada_pelo_plano": 24 * 7,
  "auto_PA:whatsapp_interrompido": 24,
};

function dedupeKey(tipo: string, topico?: string | null): string {
  return topico ? `${tipo}:${topico}` : tipo;
}

// Celular BR tem 13 dígitos com DDI (55 + DDD 2 dígitos + 9 + 8 dígitos),
// mas às vezes aparece sem esse "9" (formato legado, 12 dígitos) — mesmo
// utilitário usado em whatsapp-webhook/index.ts, copiado aqui (função pura,
// sem motivo pra acoplar as duas functions por causa disso).
function brPhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  if (!digits.startsWith("55")) return [digits];
  const rest = digits.slice(2);
  if (rest.length === 9 && rest[2] === "9") {
    return [digits, "55" + rest.slice(0, 2) + rest.slice(3)];
  }
  if (rest.length === 8) {
    return [digits, "55" + rest.slice(0, 2) + "9" + rest.slice(2)];
  }
  return [digits];
}

interface SendRequestBody {
  telefone?: string;
  texto?: string;
  tipo?: string;
  topico?: string;
  scope_id?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Autenticação por token estático dedicado — não a service_role key
  // (que daria acesso total ao banco via PostgREST caso esse token vaze
  // num cron/admin externo da Prema; esse endpoint só precisa poder
  // mandar WhatsApp, não ler/escrever o banco inteiro).
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const expectedToken = Deno.env.get("PREMA_COMUNICACAO_API_TOKEN");
  if (!expectedToken || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const url = new URL(req.url);

  // GET /prema-comunicacao/status (§4.4) — consulta se a conexão está ativa.
  if (req.method === "GET" && url.pathname.endsWith("/status")) {
    const { data: connection, error } = await supabase
      .from("whatsapp_connections")
      .select("phone_number, is_connected, is_active")
      .eq("id", PREMA_CONNECTION_ID)
      .maybeSingle();

    if (error || !connection) {
      return new Response(JSON.stringify({ error: "connection_not_found" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        connected: connection.is_connected,
        active: connection.is_active,
        phone_number: connection.phone_number,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: SendRequestBody = await req.json();
    const { telefone, texto, tipo, topico, scope_id } = body;

    if (!telefone || !texto || !tipo) {
      return new Response(JSON.stringify({ error: "campos obrigatórios: telefone, texto, tipo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (texto.length > 4000) {
      return new Response(JSON.stringify({ error: "texto excede 4000 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = dedupeKey(tipo, topico);
    const windowHours = DEDUPE_WINDOWS_HOURS[key];

    // Dedupe: só aplica se o tipo[+tópico] tem janela definida E o chamador
    // mandou scope_id (telefone, campaign_id ou network_id, conforme o
    // tipo — quem decide o escopo certo é o chamador, a API só guarda e
    // compara a chave). Best-effort: sem scope_id, nunca deduplica.
    if (windowHours && scope_id) {
      const since = new Date(Date.now() - windowHours * 3_600_000).toISOString();
      const { data: recent } = await supabase
        .from("prema_comunicacao_dedupe")
        .select("id")
        .eq("tipo", tipo)
        .eq("topico", topico ?? null)
        .eq("scope_id", scope_id)
        .gte("sent_at", since)
        .limit(1)
        .maybeSingle();

      if (recent) {
        await supabase.from("prema_comunicacao_log").insert({
          tipo, topico: topico ?? null, phone_number: telefone, status: "deduped",
        });
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "dedupe_window_active" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Resolve ou cria o contato pelo telefone.
    let { data: contact } = await supabase
      .from("contacts")
      .select("*")
      .in("phone_number", brPhoneVariants(telefone))
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!contact) {
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .insert({ phone_number: telefone })
        .select()
        .single();
      if (contactError) throw contactError;
      contact = newContact;
    }

    // 2. Envia de verdade, pela conexão fixa da Prema.
    const creds = await resolveSendCredentials(supabase, { connectionId: PREMA_CONNECTION_ID, apiSource: "evolution" });
    const sendResult = await sendWhatsAppMessage(contact, { message: texto }, creds, supabase);

    if (!sendResult.success) {
      await saveLog(supabase, { source: SOURCE, level: "error", message: `Falha ao enviar (${tipo}): ${sendResult.error}`, metadata: { telefone, tipo, topico } });
      await supabase.from("prema_comunicacao_log").insert({
        tipo, topico: topico ?? null, phone_number: telefone, contact_id: contact.id,
        status: "failed", error_message: sendResult.error,
      });
      return new Response(JSON.stringify({ success: false, error: sendResult.error }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Histórico: reusa a conversa mais recente do contato nesta conexão,
    // ou cria uma nova. is_active:false — ninguém precisa agir aqui, a
    // menos que o dono responda; se isso acontecer, o fluxo normal do
    // webhook de entrada já sabe reabrir uma conversa antiga sozinho.
    const { data: connectionRow } = await supabase
      .from("whatsapp_connections")
      .select("default_queue_id")
      .eq("id", PREMA_CONNECTION_ID)
      .maybeSingle();

    let { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("connection_id", PREMA_CONNECTION_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversation) {
      const { data: newConversation, error: convError } = await supabase
        .from("conversations")
        .insert({
          contact_id: contact.id,
          status: "human",
          is_active: false,
          api_source: "evolution",
          connection_id: PREMA_CONNECTION_ID,
          queue_id: connectionRow?.default_queue_id ?? null,
          tags: ["comunicacao-prema"],
        })
        .select("id")
        .single();
      if (convError) throw convError;
      conversation = newConversation;
    }

    const { data: message, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversation.id,
        type: "text",
        from_type: "human",
        content: texto,
        status: "delivered",
        api_source: "evolution",
        metadata: { source: "prema_comunicacao", tipo, topico: topico ?? null },
      })
      .select("id")
      .single();
    if (msgError) throw msgError;

    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversation.id);

    // 4. Registra dedupe (se essa combinação tem janela) e log de auditoria.
    if (windowHours && scope_id) {
      await supabase.from("prema_comunicacao_dedupe").insert({ tipo, topico: topico ?? null, scope_id });
    }
    await supabase.from("prema_comunicacao_log").insert({
      tipo, topico: topico ?? null, phone_number: telefone, contact_id: contact.id,
      conversation_id: conversation.id, message_id: message.id, status: "sent",
    });
    await saveLog(supabase, { source: SOURCE, level: "info", message: `Enviado (${tipo})`, metadata: { telefone, tipo, topico, message_id: message.id } });

    return new Response(
      JSON.stringify({ success: true, message_id: message.id, conversation_id: conversation.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(`[${SOURCE}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
