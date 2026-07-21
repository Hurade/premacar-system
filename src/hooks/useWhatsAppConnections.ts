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
}

export function useWhatsAppConnections() {
  const [connections, setConnections] = useState<WhatsAppConnection[]>([]);
  const [loading, setLoading] = useState(true);

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

  const createConnection = useCallback(async (data: Partial<WhatsAppConnection>) => {
    try {
      const { error } = await supabase
        .from('whatsapp_connections')
        .insert(data as any);

      if (error) throw error;
      toast.success('Conexão criada com sucesso!');
      await fetchConnections();
      return true;
    } catch (error: any) {
      toast.error('Erro ao criar conexão: ' + error.message);
      return false;
    }
  }, [fetchConnections]);

  const updateConnection = useCallback(async (id: string, data: Partial<WhatsAppConnection>) => {
    try {
      const { error } = await supabase
        .from('whatsapp_connections')
        .update(data as any)
        .eq('id', id);

      if (error) throw error;
      toast.success('Conexão atualizada!');
      await fetchConnections();
      return true;
    } catch (error: any) {
      toast.error('Erro ao atualizar: ' + error.message);
      return false;
    }
  }, [fetchConnections]);

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

  useEffect(() => {
    fetchConnections();
  }, [fetchConnections]);

  return {
    connections,
    loading,
    refetch: fetchConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    setDefaultConnection,
    getQrCode,
  };
}
