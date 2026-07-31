import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tables to sync with their timestamp column for incremental sync
const TABLES_TO_SYNC: { name: string; tsCol: string }[] = [
  { name: "contacts", tsCol: "updated_at" },
  { name: "conversations", tsCol: "updated_at" },
  { name: "messages", tsCol: "created_at" },
  { name: "deals", tsCol: "updated_at" },
  { name: "deal_activities", tsCol: "updated_at" },
  { name: "appointments", tsCol: "updated_at" },
  { name: "campaigns", tsCol: "updated_at" },
  { name: "campaign_leads", tsCol: "updated_at" },
  { name: "nina_settings", tsCol: "updated_at" },
  { name: "profiles", tsCol: "updated_at" },
  { name: "pipeline_stages", tsCol: "updated_at" },
  { name: "tag_definitions", tsCol: "updated_at" },
  { name: "teams", tsCol: "updated_at" },
  { name: "team_functions", tsCol: "updated_at" },
  { name: "team_members", tsCol: "updated_at" },
];

// Only plain identifiers are ever interpolated into SQL; values are always
// sent as bound parameters (postgres.js), never string-concatenated.
const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/i;

function assertIdent(name: string): string {
  if (!SAFE_IDENT.test(name)) throw new Error(`Identificador inválido: ${name}`);
  return name;
}

// Upsert rows using bound parameters (no SQL string interpolation of values)
// deno-lint-ignore no-explicit-any
async function upsertRows(sql: any, tableName: string, rows: Record<string, unknown>[]): Promise<void> {
  if (!rows.length) return;

  const table = assertIdent(tableName);
  const columns = Object.keys(rows[0]).map(assertIdent);
  const updateCols = columns
    .filter((c) => c !== "id")
    .map((c) => `"${c}" = EXCLUDED."${c}"`)
    .join(", ");

  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    await sql`
      INSERT INTO ${sql(table)} ${sql(batch, ...columns)}
      ON CONFLICT (id) DO UPDATE SET ${sql.unsafe(updateCols)}, synced_at = now()
    `;
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: Record<string, { count: number; status: string; error?: string }> = {};

  // Check for force_full parameter
  let forceFull = false;
  try {
    const body = await req.json();
    forceFull = body?.force_full === true;
  } catch { /* no body or not JSON */ }

  try {
    // Connect to Lovable Cloud (source)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Connect to RDS (destination)
    const rdsUrl = Deno.env.get("RDS_DATABASE_URL");
    if (!rdsUrl) {
      return new Response(
        JSON.stringify({ error: "RDS_DATABASE_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Import postgres client for RDS
    const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
    const sql = postgres(rdsUrl, { max: 3 });

    // Get last sync time (skip if force_full)
    let lastSync: string | null = null;
    if (!forceFull) {
      try {
        const lastSyncResult = await sql`
          SELECT MAX(completed_at) as last_sync FROM sync_log WHERE status = 'completed'
        `;
        const raw = lastSyncResult[0]?.last_sync;
        lastSync = raw ? new Date(raw).toISOString() : null;
      } catch {
        console.log("No previous sync found, doing full sync");
      }
    } else {
      console.log("Force full sync requested");
    }

    // Log sync start
    await sql`INSERT INTO sync_log (table_name, status) VALUES ('_full_sync', 'running')`;

    for (const tableConfig of TABLES_TO_SYNC) {
      const table = tableConfig.name;
      try {
        // Fetch data from Lovable Cloud
        let query = supabase.from(table).select("*");

        // Incremental sync: only get records updated since last sync
        if (lastSync) {
          query = query.gte(tableConfig.tsCol, lastSync);
        }

        // Handle pagination (Supabase limit is 1000)
        let allRows: Record<string, unknown>[] = [];
        let offset = 0;
        const PAGE_SIZE = 1000;

        while (true) {
          const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          allRows = allRows.concat(data);
          if (data.length < PAGE_SIZE) break;
          offset += PAGE_SIZE;
        }

        if (allRows.length === 0) {
          results[table] = { count: 0, status: "skipped" };
          continue;
        }

        // Build and execute UPSERT statements
        const statements = buildUpsertSQL(table, allRows);
        for (const stmt of statements) {
          await sql.unsafe(stmt);
        }

        results[table] = { count: allRows.length, status: "synced" };

        // Log per table
        await sql`
          INSERT INTO sync_log (table_name, records_synced, completed_at, status)
          VALUES (${table}, ${allRows.length}, now(), 'completed')
        `;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
        results[table] = { count: 0, status: "error", error: errorMsg };
        console.error(`Error syncing ${table}:`, errorMsg);

        await sql`
          INSERT INTO sync_log (table_name, status, error_message)
          VALUES (${table}, 'failed', ${errorMsg})
        `;
      }
    }

    // Update full sync log
    await sql`
      UPDATE sync_log SET completed_at = now(), status = 'completed', 
      records_synced = ${Object.values(results).reduce((s, r) => s + r.count, 0)}
      WHERE id = (
        SELECT id FROM sync_log 
        WHERE table_name = '_full_sync' AND status = 'running'
        ORDER BY started_at DESC LIMIT 1
      )
    `;

    await sql.end();

    const duration = Date.now() - startTime;
    const totalRecords = Object.values(results).reduce((s, r) => s + r.count, 0);

    return new Response(
      JSON.stringify({
        success: true,
        duration_ms: duration,
        total_records: totalRecords,
        incremental: !!lastSync,
        tables: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("Backup sync failed:", errorMsg);

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
