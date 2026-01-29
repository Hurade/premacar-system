import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_id: string | null;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'scheduled';
  daily_limit: number;
  interval_type: 'fixed' | 'random';
  interval_min: number;
  interval_max: number;
  business_hours_enabled: boolean;
  business_hours_start: string | null;
  business_hours_end: string | null;
  business_days: number[];
  anti_ban_enabled: boolean;
  pause_after_count: number | null;
  pause_duration_minutes: number | null;
  scheduled_start: string | null;
  total_leads: number;
  sent_today: number;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_replied: number;
  total_errors: number;
  last_sent_at: string | null;
  paused_until: string | null;
  created_at: string;
  updated_at: string;
  template?: MessageTemplate | null;
}

export interface CampaignLead {
  id: string;
  campaign_id: string;
  phone: string;
  name: string | null;
  company: string | null;
  city: string | null;
  product: string | null;
  custom1: string | null;
  custom2: string | null;
  custom3: string | null;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'replied' | 'error' | 'blacklisted';
  variation_used: number | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  error_message: string | null;
  attempts: number;
  whatsapp_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageTemplate {
  id: string;
  user_id: string;
  name: string;
  variations: string[];
  media_type: 'none' | 'image' | 'video' | 'document' | 'audio';
  media_urls: string[];
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  activeCampaigns: number;
  sentToday: number;
  deliveryRate: number;
  replyRate: number;
  campaignsWithErrors: number;
}

// Fetch all campaigns
export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*, template:message_templates(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Campaign[];
    },
  });
}

// Fetch campaign stats
export function useCampaignStats() {
  return useQuery({
    queryKey: ['campaign-stats'],
    queryFn: async () => {
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('status, sent_today, total_sent, total_delivered, total_replied, total_errors');

      if (error) throw error;

      const activeCampaigns = campaigns?.filter(c => c.status === 'active').length ?? 0;
      const sentToday = campaigns?.reduce((acc, c) => acc + (c.sent_today ?? 0), 0) ?? 0;
      const totalSent = campaigns?.reduce((acc, c) => acc + (c.total_sent ?? 0), 0) ?? 0;
      const totalDelivered = campaigns?.reduce((acc, c) => acc + (c.total_delivered ?? 0), 0) ?? 0;
      const totalReplied = campaigns?.reduce((acc, c) => acc + (c.total_replied ?? 0), 0) ?? 0;
      const campaignsWithErrors = campaigns?.filter(c => (c.total_errors ?? 0) > 0).length ?? 0;

      return {
        activeCampaigns,
        sentToday,
        deliveryRate: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0,
        replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
        campaignsWithErrors,
      } as CampaignStats;
    },
  });
}

// Create campaign
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: Partial<Campaign>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const insertData = {
        name: campaign.name || 'Nova Campanha',
        user_id: user.id,
        description: campaign.description,
        template_id: campaign.template_id,
        status: campaign.status || 'draft',
        daily_limit: campaign.daily_limit || 100,
        interval_type: campaign.interval_type || 'random',
        interval_min: campaign.interval_min || 60,
        interval_max: campaign.interval_max || 180,
        business_hours_enabled: campaign.business_hours_enabled ?? true,
        business_hours_start: campaign.business_hours_start || '09:00',
        business_hours_end: campaign.business_hours_end || '18:00',
        business_days: campaign.business_days || [1, 2, 3, 4, 5],
        anti_ban_enabled: campaign.anti_ban_enabled ?? true,
        pause_after_count: campaign.pause_after_count || 50,
        pause_duration_minutes: campaign.pause_duration_minutes || 15,
        scheduled_start: campaign.scheduled_start,
        total_leads: campaign.total_leads || 0,
      };

      const { data, error } = await supabase
        .from('campaigns')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar campanha: ${error.message}`);
    },
  });
}

// Update campaign
export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Campaign> & { id: string }) => {
      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar campanha: ${error.message}`);
    },
  });
}

// Delete campaign
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-stats'] });
      toast.success('Campanha excluída com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir campanha: ${error.message}`);
    },
  });
}

// Import leads to campaign
export function useImportLeads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, leads }: { campaignId: string; leads: Array<{
      phone: string;
      name?: string;
      company?: string;
      city?: string;
      product?: string;
      custom1?: string;
      custom2?: string;
      custom3?: string;
    }> }) => {
      const leadsToInsert = leads.map(lead => ({
        campaign_id: campaignId,
        phone: lead.phone,
        name: lead.name || null,
        company: lead.company || null,
        city: lead.city || null,
        product: lead.product || null,
        custom1: lead.custom1 || null,
        custom2: lead.custom2 || null,
        custom3: lead.custom3 || null,
        status: 'pending' as const,
      }));

      const { data, error } = await supabase
        .from('campaign_leads')
        .insert(leadsToInsert)
        .select();

      if (error) throw error;

      // Update total_leads count
      await supabase
        .from('campaigns')
        .update({ total_leads: leads.length })
        .eq('id', campaignId);

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] });
      toast.success('Leads importados com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao importar leads: ${error.message}`);
    },
  });
}

// Fetch campaign leads
export function useCampaignLeads(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-leads', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      
      const { data, error } = await supabase
        .from('campaign_leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CampaignLead[];
    },
    enabled: !!campaignId,
  });
}

// Fetch leads history with filters
export function useLeadsHistory(filters: {
  campaignId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['leads-history', filters],
    queryFn: async () => {
      let query = supabase
        .from('campaign_leads')
        .select('*, campaign:campaigns(name)')
        .order('sent_at', { ascending: false });

      if (filters.campaignId) {
        query = query.eq('campaign_id', filters.campaignId);
      }
      if (filters.startDate) {
        query = query.gte('sent_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('sent_at', filters.endDate);
      }
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.limit(500);

      if (error) throw error;
      return data;
    },
  });
}
