import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TAG = "[evolution-instance-manager]";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { response: authError } = await requireAdmin(req, corsHeaders);
  if (authError) return authError;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY")!;
  const EVOLUTION_BASE_URL = Deno.env.get("EVOLUTION_BASE_URL")!.replace(/\/$/, "");
  const EVOLUTION_HEADERS = {
    "apikey": EVOLUTION_API_KEY,
    "Content-Type": "application/json",
  };

  const ok = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const fail = (error: string, details?: unknown) =>
    new Response(JSON.stringify({ success: false, error, ...(details ? { details } : {}) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.json();
    const { action } = body;

    // ── CREATE ──────────────────────────────────────────────────────────────────
    if (action === "create") {
      const { connection_id, instance_name, webhook_url } = body;

      if (!connection_id || !instance_name || !webhook_url) {
        return fail("Campos obrigatórios: connection_id, instance_name, webhook_url");
      }

      console.log(`${TAG} [create] Criando instância "${instance_name}" em ${EVOLUTION_BASE_URL}`);

      const createRes = await fetch(`${EVOLUTION_BASE_URL}/instance/create`, {
        method: "POST",
        headers: EVOLUTION_HEADERS,
        body: JSON.stringify({
          instanceName: instance_name,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhook: {
            url: webhook_url,
            byEvents: false,
            base64: true,
            events: [
              "MESSAGES_UPSERT",
              "MESSAGES_UPDATE",
              "CONNECTION_UPDATE",
              "SEND_MESSAGE",
              "CHATS_UPSERT",
              "QRCODE_UPDATED",
            ],
          },
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok) {
        console.error(`${TAG} [create] Evolution ${createRes.status}:`, JSON.stringify(createData));
        return fail(`Evolution API retornou ${createRes.status}`, createData);
      }

      console.log(`${TAG} [create] Resposta Evolution:`, JSON.stringify(createData));

      // Normaliza QR — algumas versões retornam diretamente, outras aninhado
      const base64: string | null =
        createData?.qrcode?.base64 ||
        createData?.base64 ||
        createData?.instance?.qrcode?.base64 ||
        null;

      const expiresAt = new Date(Date.now() + 60_000).toISOString();

      const updatePayload: Record<string, unknown> = {
        evolution_instance_name: instance_name,
        evolution_base_url: EVOLUTION_BASE_URL,
        evolution_api_key: EVOLUTION_API_KEY,
        api_type: "evolution",
        provider: "evolution",
        is_connected: false,
      };

      if (base64) {
        updatePayload.qr_code = base64;
        updatePayload.qr_code_expires_at = expiresAt;
      }

      const { error: updateErr } = await supabase
        .from("whatsapp_connections")
        .update(updatePayload)
        .eq("id", connection_id);

      if (updateErr) {
        console.error(`${TAG} [create] Erro ao salvar no banco:`, updateErr.message);
        // Instância criada mas falhou ao salvar — retorna o que conseguiu
        return ok({ success: true, base64, instance_name, warning: "Instância criada mas falhou ao salvar credenciais: " + updateErr.message });
      }

      return ok({ success: true, base64, instance_name });
    }

    // ── QR ──────────────────────────────────────────────────────────────────────
    if (action === "qr") {
      const { connection_id, instance_name } = body;

      if (!instance_name) return fail("Campos obrigatórios: instance_name");

      console.log(`${TAG} [qr] Buscando QR da instância "${instance_name}"`);

      const qrRes = await fetch(`${EVOLUTION_BASE_URL}/instance/connect/${instance_name}`, {
        method: "GET",
        headers: EVOLUTION_HEADERS,
      });

      if (!qrRes.ok) {
        const errText = await qrRes.text();
        console.error(`${TAG} [qr] Evolution ${qrRes.status}:`, errText);
        return fail(`Evolution API retornou ${qrRes.status}`, errText);
      }

      const qrData = await qrRes.json();
      console.log(`${TAG} [qr] Resposta Evolution:`, JSON.stringify(qrData));

      const isConnected = qrData?.state === "open" || qrData?.connectionStatus === "open";

      if (isConnected) {
        if (connection_id) {
          await supabase
            .from("whatsapp_connections")
            .update({ is_connected: true, last_connected_at: new Date().toISOString() })
            .eq("id", connection_id);
        }
        return ok({ success: true, already_connected: true });
      }

      const base64: string | null =
        qrData?.base64 ||
        qrData?.qrcode?.base64 ||
        null;

      if (!base64) {
        return fail("QR code não disponível. Verifique se a instância existe na Evolution API.", qrData);
      }

      const expiresAt = new Date(Date.now() + 60_000).toISOString();

      if (connection_id) {
        await supabase
          .from("whatsapp_connections")
          .update({ qr_code: base64, qr_code_expires_at: expiresAt })
          .eq("id", connection_id);
      }

      return ok({ success: true, base64, expires_at: expiresAt });
    }

    // ── STATUS ───────────────────────────────────────────────────────────────────
    if (action === "status") {
      const { instance_name } = body;

      if (!instance_name) return fail("Campos obrigatórios: instance_name");

      console.log(`${TAG} [status] Verificando connectionState de "${instance_name}"`);

      const statusRes = await fetch(
        `${EVOLUTION_BASE_URL}/instance/connectionState/${instance_name}`,
        { method: "GET", headers: EVOLUTION_HEADERS }
      );

      if (!statusRes.ok) {
        const errText = await statusRes.text();
        console.error(`${TAG} [status] Evolution ${statusRes.status}:`, errText);
        return fail(`Evolution API retornou ${statusRes.status}`, errText);
      }

      const data = await statusRes.json();
      console.log(`${TAG} [status] Resposta Evolution:`, JSON.stringify(data));

      const state: string =
        data?.instance?.state ||
        data?.state ||
        data?.connectionStatus ||
        data?.instance?.connectionStatus ||
        "unknown";

      return ok({ success: true, is_connected: state === "open", state });
    }

    // ── DELETE ───────────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { connection_id, instance_name } = body;

      if (!instance_name) return fail("Campos obrigatórios: instance_name");

      console.log(`${TAG} [delete] Removendo instância "${instance_name}"`);

      // Tenta logout primeiro (ignora erros — instância pode já estar desconectada)
      try {
        const logoutRes = await fetch(
          `${EVOLUTION_BASE_URL}/instance/logout/${instance_name}`,
          { method: "DELETE", headers: EVOLUTION_HEADERS }
        );
        console.log(`${TAG} [delete] Logout status: ${logoutRes.status}`);
      } catch (logoutErr) {
        console.log(`${TAG} [delete] Logout ignorado:`, logoutErr instanceof Error ? logoutErr.message : logoutErr);
      }

      const deleteRes = await fetch(
        `${EVOLUTION_BASE_URL}/instance/delete/${instance_name}`,
        { method: "DELETE", headers: EVOLUTION_HEADERS }
      );

      if (!deleteRes.ok) {
        const errText = await deleteRes.text();
        console.error(`${TAG} [delete] Evolution ${deleteRes.status}:`, errText);
        return fail(`Evolution API retornou ${deleteRes.status} ao deletar`, errText);
      }

      console.log(`${TAG} [delete] Instância "${instance_name}" removida.`);

      // Limpa os campos de credenciais Evolution na conexão, se connection_id fornecido
      if (connection_id) {
        await supabase
          .from("whatsapp_connections")
          .update({
            evolution_instance_name: null,
            is_connected: false,
            qr_code: null,
            qr_code_expires_at: null,
          })
          .eq("id", connection_id);
      }

      return ok({ success: true });
    }

    // ── AÇÃO DESCONHECIDA ────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ success: false, error: "action inválida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error(`${TAG} Erro fatal:`, err);
    return fail(err instanceof Error ? err.message : "Erro desconhecido");
  }
});
