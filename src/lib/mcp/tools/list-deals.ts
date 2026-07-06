import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_deals",
  title: "List deals",
  description: "List the signed-in user's pipeline deals from PremaCar.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 20)."),
    stage_id: z.string().optional().describe("Optional pipeline stage id to filter by."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, stage_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (stage_id) q = q.eq("stage_id", stage_id);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { deals: data ?? [] },
    };
  },
});
