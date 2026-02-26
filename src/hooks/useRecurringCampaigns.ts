import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RecurringCampaign {
  id: string;
  name: string;
  description: string | null;
  objective: string | null;
  flow_config: any;
  status: string;
  total_contacts: number;
  in_progress_count: number;
  success_count: number;
  failed_count: number;
  estimated_cost: number;
  actual_cost: number;
  created_by: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  ended_at: string | null;
}

interface UseRecurringCampaignsParams {
  filter?: string;
  search?: string;
}

export function useRecurringCampaigns({ filter = 'all', search = '' }: UseRecurringCampaignsParams = {}) {
  const [campaigns, setCampaigns] = useState<RecurringCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('recurring_campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      setCampaigns((data as any[]) || []);
    } catch (error) {
      console.error('Erro ao buscar campanhas recorrentes:', error);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    const { error } = await supabase
      .from('recurring_campaigns')
      .update({ status: newStatus } as any)
      .eq('id', id);
    if (!error) fetchCampaigns();
  };

  const deleteCampaign = async (id: string) => {
    const { error } = await supabase
      .from('recurring_campaigns')
      .delete()
      .eq('id', id);
    if (!error) fetchCampaigns();
  };

  return { campaigns, loading, refetch: fetchCampaigns, toggleStatus, deleteCampaign };
}

export function useRecurringCampaignStats() {
  const [stats, setStats] = useState({
    active_campaigns: 0,
    active_contacts: 0,
    success_rate: 0,
    total_cost: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        const { data, error } = await supabase.rpc('get_recurring_campaign_stats');
        if (error) throw error;
        if (data) setStats(data as any);
      } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return { stats, loading };
}
