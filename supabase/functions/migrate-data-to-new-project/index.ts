// Função temporária de migração — roda no projeto ATUAL (acesso interno
// automático via SUPABASE_SERVICE_ROLE_KEY, sem precisar da connection
// string dele, que o Lovable Cloud não expõe) e escreve direto no projeto
// NOVO via TARGET_DB_URL (connection string normal, sem restrição lá).
//
// Uma tabela + um lote por chamada (evita timeout da function em tabelas
// grandes como messages). Usa session_replication_role=replica na sessão
// de escrita pra pular checagem de FK — não precisa se preocupar com
// ordem de dependência entre tabelas nem com auth.users ainda não migrado.
//
// DELETAR esta função depois que a migração de dados terminar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-migration-secret",
};

const BATCH_SIZE = 500;

// Colunas que são array nativo do Postgres (text[]/integer[]) — tratadas
// diferente de JSONB na hora de serializar pro insert.
const ARRAY_COLUMNS = new Set([
  "attendees",
  "business_days",
  "handoff_keywords",
  "scheduling_available_days",
  "tags",
]);

function prepareRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== null && typeof value === "object" && !ARRAY_COLUMNS.has(key)) {
      // JSONB (objeto ou array que não é coluna de array nativo) — manda
      // como string JSON; Postgres faz o cast implícito pra jsonb/json.
      out[key] = JSON.stringify(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const migrationSecret = req.headers.get("x-migration-secret");
  if (!migrationSecret || migrationSecret !== Deno.env.get("AI_GATEWAY_SECRET")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { table, offset = 0 } = await req.json();
    if (!table || typeof table !== "string") {
      return new Response(JSON.stringify({ error: "table é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data, error, count } = await supabase
      .from(table)
      .select("*", { count: "exact" })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      return new Response(JSON.stringify({ error: error.message, table }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({ done: true, table, copiedThisCall: 0, totalRowsInTable: count ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const targetUrl = Deno.env.get("TARGET_DB_URL")!;
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(targetUrl, { max: 1 });

    const rows = data.map(prepareRow);

    try {
      await sql.begin(async (tx: any) => {
        await tx`SET session_replication_role = replica`;
        await tx`INSERT INTO ${tx(table)} ${tx(rows)} ON CONFLICT DO NOTHING`;
      });
    } finally {
      await sql.end();
    }

    return new Response(
      JSON.stringify({
        table,
        copiedThisCall: rows.length,
        nextOffset: offset + rows.length,
        done: rows.length < BATCH_SIZE,
        totalRowsInTable: count ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[migrate-data-to-new-project] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
