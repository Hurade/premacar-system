import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthResult {
  userId: string | null;
  isServiceRole: boolean;
  isAdmin: boolean;
}

/**
 * Autentica a requisição de uma edge function.
 *
 * Aceita:
 *  - JWT de usuário logado (Authorization: Bearer <access_token>)
 *  - service_role key (chamadas internas entre funções / cron)
 *
 * Retorna `null` quando não há credencial válida.
 */
export async function authenticate(req: Request): Promise<AuthResult | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Chamada interna com service_role
  if (token === serviceKey) {
    return { userId: null, isServiceRole: true, isAdmin: true };
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  const userId = data.user.id;

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  const { data: memberRow } = await admin
    .from("team_members")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  const isAdmin = !!roleRow;
  if (!isAdmin && !memberRow) return null; // usuário sem acesso operacional

  return { userId, isServiceRole: false, isAdmin };
}

export function unauthorized(corsHeaders: Record<string, string>, message = "Unauthorized") {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function forbidden(corsHeaders: Record<string, string>, message = "Forbidden") {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Exige usuário autenticado (membro ativo) ou service_role. */
export async function requireAuth(req: Request, corsHeaders: Record<string, string>) {
  const auth = await authenticate(req);
  if (!auth) return { auth: null, response: unauthorized(corsHeaders) };
  return { auth, response: null };
}

/** Exige admin (ou service_role). */
export async function requireAdmin(req: Request, corsHeaders: Record<string, string>) {
  const auth = await authenticate(req);
  if (!auth) return { auth: null, response: unauthorized(corsHeaders) };
  if (!auth.isAdmin) return { auth: null, response: forbidden(corsHeaders, "Requer permissão de administrador") };
  return { auth, response: null };
}
