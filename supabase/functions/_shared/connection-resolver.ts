// Resolve credenciais de envio (Evolution ou Meta) a partir de uma
// conexão específica em whatsapp_connections, com fallback para a
// linha global legada em nina_settings quando a conversa/campanha
// ainda não tem connection_id (dado pré-existente, ou conexão
// excluída/inativa). Consolida a lógica que antes existia duplicada
// em whatsapp-sender, nina-orchestrator, campaign-processor,
// recurring-campaign-processor e followup-processor — todos liam
// sempre a mesma linha global de nina_settings, ignorando qual
// conexão a conversa/campanha realmente usa.

export interface SendCredentials {
  api_type: 'meta' | 'evolution';
  meta_phone_number_id?: string | null;
  meta_access_token?: string | null;
  evolution_api_url?: string | null;
  evolution_api_key?: string | null;
  evolution_instance_name?: string | null;
}

export async function resolveSendCredentials(
  supabase: any,
  opts: { connectionId?: string | null; apiSource: 'evolution' | 'meta' }
): Promise<SendCredentials> {
  if (opts.connectionId) {
    const { data: conn } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('id', opts.connectionId)
      .eq('is_active', true)
      .maybeSingle();

    if (conn) {
      return conn.api_type === 'meta_official'
        ? {
            api_type: 'meta',
            meta_phone_number_id: conn.meta_phone_number_id,
            meta_access_token: conn.meta_access_token,
          }
        : {
            api_type: 'evolution',
            evolution_api_url: conn.evolution_base_url,
            evolution_api_key: conn.evolution_api_key,
            evolution_instance_name: conn.evolution_instance_name,
          };
    }
    // Conexão excluída/inativa — cai no fallback legado abaixo
  }

  // Fallback legado: mesmo comportamento de sempre, mantém dados
  // pré-existentes (connection_id = null) funcionando sem mudança.
  if (opts.apiSource === 'meta') {
    const { data } = await supabase
      .from('nina_settings')
      .select('meta_phone_number_id, meta_access_token, meta_api_enabled')
      .eq('meta_api_enabled', true)
      .limit(1)
      .maybeSingle();

    if (!data?.meta_api_enabled) {
      throw new Error('Meta API not configured');
    }
    return {
      api_type: 'meta',
      meta_phone_number_id: data.meta_phone_number_id,
      meta_access_token: data.meta_access_token,
    };
  }

  const { data } = await supabase
    .from('nina_settings')
    .select('evolution_api_url, evolution_api_key, evolution_instance_name, evolution_api_enabled')
    .not('evolution_api_url', 'is', null)
    .limit(1)
    .maybeSingle();

  if (!data?.evolution_api_url || !data?.evolution_api_key || !data?.evolution_instance_name) {
    throw new Error('Evolution API not configured');
  }
  return {
    api_type: 'evolution',
    evolution_api_url: data.evolution_api_url,
    evolution_api_key: data.evolution_api_key,
    evolution_instance_name: data.evolution_instance_name,
  };
}
