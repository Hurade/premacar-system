import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Tables to sync (no queue tables)
const TABLES_TO_SYNC = [
  "contacts",
  "conversations",
  "messages",
  "deals",
  "deal_activities",
  "appointments",
  "campaigns",
  "campaign_leads",
  "nina_settings",
  "profiles",
  "pipeline_stages",
  "tag_definitions",
  "teams",
  "team_functions",
  "team_members",
];

// Build UPSERT SQL dynamically based on table data
function buildUpsertSQL(tableName: string, rows: Record<string, unknown>[]): string[] {
  if (!rows.length) return [];

  const statements: string[] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const columns = Object.keys(batch[0]);
    const colList = columns.map((c) => `"${c}"`).join(", ");

    const valueRows = batch.map((row) => {
      const vals = columns.map((col) => {
        const v = row[col];
        if (v === null || v === undefined) return "NULL";
        if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
        if (typeof v === "number") return String(v);
        if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
        if (Array.isArray(v)) return `ARRAY[${(v as string[]).map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",")}]::text[]`;
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      return `(${vals.join(", ")})`;
    });

    const updateCols = columns
      .filter((c) => c !== "id")
      .map((c) => `"${c}" = EXCLUDED."${c}"`)
      .join(", ");

    statements.push(
      `INSERT INTO "${tableName}" (${colList}) VALUES ${valueRows.join(", ")} ON CONFLICT (id) DO UPDATE SET ${updateCols}, synced_at = now();`
    );
  }

  return statements;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const results: Record<string, { count: number; status: string; error?: string }> = {};

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

    // Get last sync time
    let lastSync: string | null = null;
    try {
      const lastSyncResult = await sql`
        SELECT MAX(completed_at) as last_sync FROM sync_log WHERE status = 'completed'
      `;
      lastSync = lastSyncResult[0]?.last_sync || null;
    } catch {
      // sync_log table might not exist yet on first run
      console.log("No previous sync found, doing full sync");
    }

    // Log sync start
    await sql`INSERT INTO sync_log (table_name, status) VALUES ('_full_sync', 'running')`;

    for (const table of TABLES_TO_SYNC) {
      try {
        // Fetch data from Lovable Cloud
        let query = supabase.from(table).select("*");

        // Incremental sync: only get records updated since last sync
        if (lastSync) {
          query = query.gte("updated_at", lastSync);
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
        const errorMsg = err instanceof Error ? err.message : String(err);
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
      WHERE table_name = '_full_sync' AND status = 'running'
      ORDER BY started_at DESC LIMIT 1
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
