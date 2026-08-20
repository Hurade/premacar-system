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

  const DEFAULT_CALL_REJECTION_MESSAGE =
    "Olá! No momento não atendemos chamadas de voz/vídeo por aqui. Pode escrever sua mensagem que já te respondemos por texto. 🙂";

  // Liga a recusa automática de chamadas de voz/vídeo (rejectCall + msgCall) —
  // usada tanto pela ação dedicada quanto automaticamente ao criar toda
  // instância nova, pra já nascer com esse comportamento por padrão.
  const applyCallRejection = async (instance_name: string, message?: string) => {
    const rejectMessage = message || DEFAULT_CALL_REJECTION_MESSAGE;

    // Busca as settings atuais primeiro — settings/set costuma substituir o
    // objeto inteiro, então preserva o que já está configurado (ex:
    // alwaysOnline, readMessages) e só muda rejectCall/msgCall.
    const currentRes = await fetch(
      `${EVOLUTION_BASE_URL}/settings/find/${instance_name}`,
      { method: "GET", headers: EVOLUTION_HEADERS }
    );
    const current = currentRes.ok ? await currentRes.json().catch(() => ({})) : {};

    const settingsPayload = {
      rejectCall: true,
      msgCall: rejectMessage,
      groupsIgnore: current?.groupsIgnore ?? current?.groups_ignore ?? false,
      alwaysOnline: current?.alwaysOnline ?? current?.always_online ?? true,
      readMessages: current?.readMessages ?? current?.read_messages ?? false,
      readStatus: current?.readStatus ?? current?.read_status ?? false,
      syncFullHistory: current?.syncFullHistory ?? current?.sync_full_history ?? false,
    };

    const setRes = await fetch(
      `${EVOLUTION_BASE_URL}/settings/set/${instance_name}`,
      { method: "POST", headers: EVOLUTION_HEADERS, body: JSON.stringify(settingsPayload) }
    );
    const setData = await setRes.json().catch(() => null);

    return { ok: setRes.ok, status: setRes.status, data: setData, settingsPayload };
  };

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
              "CALL",
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

      // Toda instância nova já nasce com recusa automática de chamada ligada
      // — não bloqueia a criação se isso falhar (ex: instância ainda não
      // totalmente pronta no servidor logo após criar), só loga o aviso.
      try {
        const callRejectionResult = await applyCallRejection(instance_name);
        if (!callRejectionResult.ok) {
          console.warn(`${TAG} [create] Falha ao ligar recusa de chamada (não bloqueante):`, callRejectionResult.status, JSON.stringify(callRejectionResult.data));
        } else {
          console.log(`${TAG} [create] Recusa de chamada ligada por padrão para "${instance_name}"`);
        }
      } catch (callRejectionErr) {
        console.warn(`${TAG} [create] Erro ao ligar recusa de chamada (não bloqueante):`, callRejectionErr instanceof Error ? callRejectionErr.message : callRejectionErr);
      }

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

      // fetchInstances traz o número/dono pareado — connectionState não traz.
      // Usado pra diagnosticar duas instâncias apontando pro mesmo WhatsApp.
      let ownerInfo: unknown = null;
      try {
        const fetchRes = await fetch(
          `${EVOLUTION_BASE_URL}/instance/fetchInstances?instanceName=${instance_name}`,
          { method: "GET", headers: EVOLUTION_HEADERS }
        );
        ownerInfo = await fetchRes.json().catch(() => null);
      } catch (fetchErr) {
        console.warn(`${TAG} [status] fetchInstances falhou (não bloqueante):`, fetchErr instanceof Error ? fetchErr.message : fetchErr);
      }

      return ok({ success: true, is_connected: state === "open", state, raw: data, ownerInfo });
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

    // ── LOGOUT ───────────────────────────────────────────────────────────────────
    if (action === "logout") {
      const { connection_id, instance_name } = body;

      if (!instance_name) return fail("Campos obrigatórios: instance_name");

      console.log(`${TAG} [logout] Desconectando instância "${instance_name}"`);

      const logoutRes = await fetch(
        `${EVOLUTION_BASE_URL}/instance/logout/${instance_name}`,
        { method: "DELETE", headers: EVOLUTION_HEADERS }
      );

      if (!logoutRes.ok) {
        const errText = await logoutRes.text();
        console.error(`${TAG} [logout] Evolution ${logoutRes.status}:`, errText);
        return fail(`Evolution API retornou ${logoutRes.status} ao fazer logout`, errText);
      }

      console.log(`${TAG} [logout] Instância "${instance_name}" desconectada.`);

      if (connection_id) {
        await supabase
          .from("whatsapp_connections")
          .update({ is_connected: false, qr_code: null, qr_code_expires_at: null })
          .eq("id", connection_id);
      }

      return ok({ success: true });
    }

    // ── SET_WEBHOOK ──────────────────────────────────────────────────────────────
    if (action === "set_webhook") {
      const { instance_name, webhook_url } = body;

      if (!instance_name || !webhook_url) {
        return fail("Campos obrigatórios: instance_name, webhook_url");
      }

      console.log(`${TAG} [set_webhook] Configurando webhook de "${instance_name}" → ${webhook_url}`);

      const webhookPayloadNested = {
        webhook: {
          enabled: true,
          url: webhook_url,
          byEvents: false,
          base64: false,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
            "SEND_MESSAGE",
            "CHATS_UPSERT",
            "QRCODE_UPDATED",
            "CALL",
          ],
        },
      };

      const webhookRes = await fetch(
        `${EVOLUTION_BASE_URL}/webhook/set/${instance_name}`,
        { method: "POST", headers: EVOLUTION_HEADERS, body: JSON.stringify(webhookPayloadNested) }
      );

      const webhookData = await webhookRes.json().catch(() => null);
      console.log(`${TAG} [set_webhook] Resposta nested (${webhookRes.status}):`, JSON.stringify(webhookData));

      if (webhookRes.ok) {
        return ok({ success: true, format: "nested" });
      }

      // Fallback: formato flat na raiz (algumas versões da Evolution v1)
      console.warn(`${TAG} [set_webhook] Nested rejeitado, tentando formato flat...`);

      const webhookPayloadFlat = {
        enabled: true,
        url: webhook_url,
        webhook_by_events: false,
        webhook_base64: false,
        events: [
          "MESSAGES_UPSERT",
          "MESSAGES_UPDATE",
          "CONNECTION_UPDATE",
          "SEND_MESSAGE",
          "CHATS_UPSERT",
          "QRCODE_UPDATED",
          "CALL",
        ],
      };

      const webhookResFallback = await fetch(
        `${EVOLUTION_BASE_URL}/webhook/set/${instance_name}`,
        { method: "POST", headers: EVOLUTION_HEADERS, body: JSON.stringify(webhookPayloadFlat) }
      );

      const webhookDataFallback = await webhookResFallback.json().catch(() => null);
      console.log(`${TAG} [set_webhook] Resposta flat (${webhookResFallback.status}):`, JSON.stringify(webhookDataFallback));

      if (!webhookResFallback.ok) {
        return fail(
          `Evolution API rejeitou ambos os formatos de webhook (${webhookRes.status}, ${webhookResFallback.status})`,
          { nested: webhookData, flat: webhookDataFallback }
        );
      }

      return ok({ success: true, format: "flat" });
    }

    // ── SET_CALL_REJECTION ───────────────────────────────────────────────────────
    // Liga a recusa automática de chamadas de voz/vídeo na instância (a Evolution
    // recusa e já manda o aviso pro cliente sozinha, sem precisar de código nosso
    // pra isso — só registramos o ocorrido na conversa, no whatsapp-webhook).
    // Toda instância NOVA já chama isso automaticamente (ver ação "create"); esta
    // ação existe à parte pra aplicar/reaplicar em instâncias já existentes.
    if (action === "set_call_rejection") {
      const { instance_name, message } = body;

      if (!instance_name) return fail("Campos obrigatórios: instance_name");

      console.log(`${TAG} [set_call_rejection] Configurando recusa de chamadas em "${instance_name}"`);
      const result = await applyCallRejection(instance_name, message);
      console.log(`${TAG} [set_call_rejection] Resposta (${result.status}):`, JSON.stringify(result.data));

      if (!result.ok) {
        return fail(`Evolution API retornou ${result.status}`, result.data);
      }

      return ok({ success: true, settings: result.settingsPayload });
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
