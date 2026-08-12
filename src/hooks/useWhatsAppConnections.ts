import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WhatsAppConnection {
  id: string;
  name: string;
  phone_number: string;
  api_type: 'evolution' | 'meta_official';
  evolution_instance_name: string | null;
  evolution_api_key: string | null;
  evolution_base_url: string | null;
  meta_phone_number_id: string | null;
  meta_access_token: string | null;
  meta_business_account_id: string | null;
  meta_app_secret: string | null;
  meta_verify_token: string | null;
  default_queue_id: string | null;
  is_active: boolean;
  is_connected: boolean;
  is_default: boolean;
  last_connected_at: string | null;
  qr_code: string | null;
  qr_code_expires_at: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  /** Sistemas/marcas que esta conexão representa (ex: Automax Frotas + Oficina + Maxsig na mesma conexão). Carregado via connection_systems. */
  system_ids?: string[];
}

export interface SystemOption {
  id: string;
  slug: string;
  name: string;
  greeting_label: string;
}

export function useWhatsAppConnections() {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [systems, setSystems] = useState<SystemOption[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSystems = useCallback(async () => {
    const { data, error } = await supabase.from('systems').select('*').eq('is_active', true).order('name');
    if (error) {
      console.error('Erro ao carregar sistemas:', error);
      return;
    }
    setSystems((data || []) as unknown as SystemOption[]);
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const list: WhatsAppConnection[] = (data || []) as unknown as WhatsAppConnection[];

      if (list.length > 0) {
        const { data: links } = await supabase
          .from('connection_systems')
          .select('connection_id, system_id')
          .in('connection_id', list.map((c) => c.id));
        const byConnection = new Map<string, string[]>();
        for (const link of links || []) {
          const arr = byConnection.get((link as any).connection_id) || [];
          arr.push((link as any).system_id);
          byConnection.set((link as any).connection_id, arr);
        }
        for (const conn of list) {
          conn.system_ids = byConnection.get(conn.id) || [];
        }
      }

      // Se não há conexões cadastradas, detecta credenciais legadas em nina_settings
      if (list.length === 0) {
        const { data: ns } = await supabase
          .from('nina_settings')
          .select('meta_access_token, meta_phone_number_id, meta_business_account_id, evolution_api_url, evolution_api_key, evolution_instance_name')
          .limit(1)
          .maybeSingle();

        if (ns?.meta_access_token && ns?.meta_phone_number_id) {
          list.push({
            id: '__legacy_meta__',
            name: 'API Meta Oficial',
            phone_number: ns.meta_phone_number_id,
            api_type: 'meta_official',
            meta_phone_number_id: ns.meta_phone_number_id,
            meta_access_token: ns.meta_access_token,
            meta_business_account_id: ns.meta_business_account_id ?? null,
            meta_app_secret: null,
            meta_verify_token: null,
            default_queue_id: null,
            evolution_instance_name: null,
            evolution_api_key: null,
            evolution_base_url: null,
            is_active: true,
            is_connected: true,
            is_default: true,
            last_connected_at: null,
            qr_code: null,
            qr_code_expires_at: null,
            user_id: null,
            created_at: '',
            updated_at: '',
          });
        } else if (ns?.evolution_api_url && ns?.evolution_api_key) {
          list.push({
            id: '__legacy_evolution__',
            name: 'Evolution API',
            phone_number: '',
            api_type: 'evolution',
            evolution_instance_name: ns.evolution_instance_name ?? null,
            evolution_api_key: ns.evolution_api_key,
            evolution_base_url: ns.evolution_api_url,
            meta_phone_number_id: null,
            meta_access_token: null,
            meta_business_account_id: null,
            meta_app_secret: null,
            meta_verify_token: null,
            default_queue_id: null,
            is_active: true,
            is_connected: true,
            is_default: true,
            last_connected_at: null,
            qr_code: null,
            qr_code_expires_at: null,
            user_id: null,
            created_at: '',
            updated_at: '',
          });
        }
      }

      setConnections(list);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // system_ids não é coluna de whatsapp_connections — vive em connection_systems
  // (N:N, uma conexão pode representar mais de um sistema/marca).
  const syncConnectionSystems = useCallback(async (connectionId: string, systemIds: string[] | undefined) => {
    if (!systemIds) return;
    await supabase.from('connection_systems').delete().eq('connection_id', connectionId);
    if (systemIds.length > 0) {
      await supabase.from('connection_systems').insert(systemIds.map((system_id) => ({ connection_id: connectionId, system_id })));
    }
  }, []);

  const createConnection = useCallback(async (data: Partial<WhatsAppConnection>) => {
    try {
      const { system_ids, ...connectionData } = data;
      const { data: created, error } = await supabase
        .from('whatsapp_connections')
        .insert(connectionData as any)
        .select('id')
        .single();

      if (error) throw error;
      if (created) await syncConnectionSystems(created.id, system_ids);
      toast.success('Conexão criada com sucesso!');
      await fetchConnections();
      return true;
    } catch (error: any) {
      toast.error('Erro ao criar conexão: ' + error.message);
      return false;
    }
  }, [fetchConnections, syncConnectionSystems]);

  const updateConnection = useCallback(async (id: string, data: Partial<WhatsAppConnection>) => {
    try {
      const { system_ids, ...connectionData } = data;
      const { error } = await supabase
        .from('whatsapp_connections')
        .update(connectionData as any)
        .eq('id', id);

      if (error) throw error;
      await syncConnectionSystems(id, system_ids);
      toast.success('Conexão atualizada!');
      await fetchConnections();
      return true;
    } catch (error: any) {
      toast.error('Erro ao atualizar: ' + error.message);
      return false;
    }
  }, [fetchConnections, syncConnectionSystems]);

  const deleteConnection = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('whatsapp_connections')
        .update({ is_active: false } as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('Conexão removida!');
      await fetchConnections();
    } catch (error: any) {
      toast.error('Erro ao remover: ' + error.message);
    }
  }, [fetchConnections]);

  // Define uma conexão como padrão (remove is_default das outras do mesmo user)
  const setDefaultConnection = useCallback(async (id: string) => {
    try {
      const conn = connections.find(c => c.id === id);
      if (!conn || conn.id.startsWith('__legacy_')) return;

      // Remove default das outras
      await supabase
        .from('whatsapp_connections')
        .update({ is_default: false } as any)
        .eq('is_active', true)
        .neq('id', id);

      // Define esta como default
      await supabase
        .from('whatsapp_connections')
        .update({ is_default: true } as any)
        .eq('id', id);

      toast.success(`${conn.name} definida como conexão padrão`);
      await fetchConnections();
    } catch (error: any) {
      toast.error('Erro ao definir padrão: ' + error.message);
    }
  }, [connections, fetchConnections]);

  // Testa a conexão e atualiza is_connected no banco
  const testConnection = useCallback(async (id: string) => {
    const conn = connections.find(c => c.id === id);
    if (!conn) return false;

    try {
      if (conn.api_type === 'evolution') {
        const { data, error } = await supabase.functions.invoke('test-evolution-connection', {
          body: {
            api_url: conn.evolution_base_url,
            api_key: conn.evolution_api_key,
            instance_name: conn.evolution_instance_name,
          },
        });
        if (error) throw error;
        // test-evolution-connection retorna { success, is_connected, instance_status }
        const isConnected = data?.is_connected === true;

        await supabase
          .from('whatsapp_connections')
          .update({
            is_connected: isConnected,
            last_connected_at: isConnected ? new Date().toISOString() : null,
          } as any)
          .eq('id', id);

        await fetchConnections();

        if (isConnected) {
          toast.success(`${conn.name}: Conectado!`);
        } else {
          const status = data?.instance_status || 'desconectado';
          toast.error(`${conn.name}: ${status}`);
        }
        return isConnected;
      } else {
        const { data, error } = await supabase.functions.invoke('test-meta-connection', {
          body: {
            phone_number_id: conn.meta_phone_number_id,
            access_token: conn.meta_access_token,
          },
        });
        if (error) throw error;
        const isConnected = data?.connected === true || data?.is_connected === true;

        await supabase
          .from('whatsapp_connections')
          .update({
            is_connected: isConnected,
            last_connected_at: isConnected ? new Date().toISOString() : null,
          } as any)
          .eq('id', id);

        await fetchConnections();

        if (isConnected) {
          toast.success(`${conn.name}: Conectado!`);
        } else {
          toast.error(`${conn.name}: Desconectado`);
        }
        return isConnected;
      }
    } catch (error: any) {
      toast.error(`Erro ao testar: ${error.message}`);
      return false;
    }
  }, [connections, fetchConnections]);

  // Busca QR code para uma conexão Evolution não conectada
  const getQrCode = useCallback(async (id: string): Promise<{ base64: string | null; already_connected?: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.functions.invoke('get-evolution-qr-code', {
        body: { connection_id: id },
      });
      if (error) throw error;
      if (data?.already_connected) {
        await fetchConnections();
        return { base64: null, already_connected: true };
      }
      return { base64: data?.base64 ?? null, error: data?.error };
    } catch (error: any) {
      return { base64: null, error: error.message };
    }
  }, [fetchConnections]);

  // Cria instância Evolution automaticamente (nome amigável → slug → edge function)
  const createEvolutionInstance = useCallback(async (params: {
    name: string;
    phone_number: string;
    default_queue_id: string | null;
    system_ids: string[];
  }): Promise<{ success: boolean; connectionId?: string; instanceName?: string; error?: string }> => {
    try {
      const slug = params.name
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      const instanceName = `premacar-${slug}-${Date.now().toString(36)}`;

      const { data: created, error: insErr } = await supabase
        .from('whatsapp_connections')
        .insert({
          name: params.name,
          phone_number: params.phone_number,
          api_type: 'evolution',
          evolution_instance_name: instanceName,
          default_queue_id: params.default_queue_id,
          is_active: true,
          is_connected: false,
        } as any)
        .select('id')
        .single();
      if (insErr) throw insErr;
      const connectionId = created.id;

      await syncConnectionSystems(connectionId, params.system_ids);

      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      const { data: result, error: fnErr } = await supabase.functions.invoke('evolution-instance-manager', {
        body: {
          action: 'create',
          connection_id: connectionId,
          instance_name: instanceName,
          webhook_url: webhookUrl,
        },
      });
      if (fnErr) throw fnErr;
      if (result?.success === false) {
        await supabase.from('whatsapp_connections').update({ is_active: false } as any).eq('id', connectionId);
        return { success: false, error: result?.error || 'Falha ao criar instância' };
      }

      await fetchConnections();
      return { success: true, connectionId, instanceName };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [fetchConnections, syncConnectionSystems]);

  // Lê status e QR diretamente do banco (o webhook mantém atualizado)
  const pollConnectionStatus = useCallback(async (connectionId: string): Promise<{ is_connected: boolean; qr_code: string | null }> => {
    const { data } = await supabase
      .from('whatsapp_connections')
      .select('is_connected, qr_code')
      .eq('id', connectionId)
      .maybeSingle();
    return { is_connected: data?.is_connected ?? false, qr_code: data?.qr_code ?? null };
  }, []);

  // Logout da instância Evolution sem deletá-la (mantém a instância, só desconecta o celular)
  const disconnectConnection = useCallback(async (id: string): Promise<boolean> => {
    const conn = connections.find(c => c.id === id);
    if (!conn || conn.api_type !== 'evolution' || !conn.evolution_instance_name) return false;
    try {
      const { data, error } = await supabase.functions.invoke('evolution-instance-manager', {
        body: { action: 'logout', connection_id: id, instance_name: conn.evolution_instance_name },
      });
      if (error) throw error;
      if (data?.success === false) {
        toast.error(data?.error || 'Falha ao desconectar');
        return false;
      }
      toast.success(`${conn.name} desconectada`);
      await fetchConnections();
      return true;
    } catch (e: any) {
      toast.error('Erro ao desconectar: ' + e.message);
      return false;
    }
  }, [connections, fetchConnections]);

  // Reaplicar config de webhook (byEvents=false, base64=false) em instância existente
  const fixConnectionWebhook = useCallback(async (id: string): Promise<boolean> => {
    const conn = connections.find(c => c.id === id);
    if (!conn || conn.api_type !== 'evolution' || !conn.evolution_instance_name) return false;
    try {
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;
      const { data, error } = await supabase.functions.invoke('evolution-instance-manager', {
        body: { action: 'set_webhook', instance_name: conn.evolution_instance_name, webhook_url: webhookUrl },
      });
      if (error) throw error;
      if (data?.success === false) {
        toast.error(data?.error || 'Falha ao reconfigurar webhook');
        return false;
      }
      toast.success('Webhook reconfigurado (base64=false). Mídia deve funcionar agora.');
      return true;
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
      return false;
    }
  }, [connections]);

  useEffect(() => {
    fetchConnections();
    fetchSystems();
  }, [fetchConnections, fetchSystems]);

  return {
    connections,
    systems,
    loading,
    refetch: fetchConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    setDefaultConnection,
    getQrCode,
    createEvolutionInstance,
    pollConnectionStatus,
    disconnectConnection,
    fixConnectionWebhook,
  };
}
