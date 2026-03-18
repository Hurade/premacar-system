import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

interface SaveLogParams {
  source: string;
  level: 'info' | 'error' | 'warning';
  message: string;
  metadata?: Record<string, unknown>;
  user_id?: string;
}

export async function saveLog(
  supabase: SupabaseClient,
  params: SaveLogParams
): Promise<void> {
  try {
    await supabase.from('system_logs').insert({
      source: params.source,
      level: params.level,
      message: params.message,
      metadata: params.metadata || null,
      user_id: params.user_id || null,
    });
  } catch {
    // Never throw — logging must not break the main flow
  }
}
