import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CampaignVariation {
  id: string;
  campaign_id: string;
  label: string;
  name: string;
  weight: number;
  meta_template_id: string | null;
  total_sent: number;
  total_delivered: number;
  total_read: number;
  total_replied: number;
  total_errors: number;
  is_winner: boolean;
  is_active: boolean;
  created_at: string;
  meta_template?: { name: string; display_name: string; body_text: string } | null;
}

export interface CampaignSendRules {
  id?: string;
  campaign_id: string;
  max_per_hour: number;
  max_per_day: number;
  min_interval_seconds: number;
  max_interval_seconds: number;
  auto_pause_on_errors: boolean;
  error_rate_threshold: number;
  error_window_sends: number;
  pause_duration_minutes: number;
  ab_auto_winner: boolean;
  ab_winner_min_sends: number;
  ab_winner_metric: 'reply_rate' | 'read_rate' | 'delivery_rate';
}

export const DEFAULT_SEND_RULES: Omit<CampaignSendRules, 'campaign_id'> = {
  max_per_hour: 200,
  max_per_day: 1000,
  min_interval_seconds: 3,
  max_interval_seconds: 10,
  auto_pause_on_errors: true,
  error_rate_threshold: 15,
  error_window_sends: 30,
  pause_duration_minutes: 60,
  ab_auto_winner: false,
  ab_winner_min_sends: 100,
  ab_winner_metric: 'reply_rate',
};

// ── Computed helpers ──────────────────────────────────────────────

export function deliveryRate(v: CampaignVariation) {
  return v.total_sent > 0 ? Math.round((v.total_delivered / v.total_sent) * 100) : 0;
}
export function readRate(v: CampaignVariation) {
  return v.total_sent > 0 ? Math.round((v.total_read / v.total_sent) * 100) : 0;
}
export function replyRate(v: CampaignVariation) {
  return v.total_sent > 0 ? Math.round((v.total_replied / v.total_sent) * 100) : 0;
}
export function errorRate(v: CampaignVariation) {
  return v.total_sent > 0 ? Math.round((v.total_errors / v.total_sent) * 100) : 0;
}

// ── Queries ───────────────────────────────────────────────────────

export function useCampaignVariations(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-variations', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];
      const { data, error } = await supabase
        .from('campaign_variations')
        .select('*, meta_template:meta_templates(name, display_name, body_text)')
        .eq('campaign_id', campaignId)
        .order('label');
      if (error) throw error;
      return data as CampaignVariation[];
    },
    enabled: !!campaignId,
    refetchInterval: 30_000,
  });
}

export function useCampaignSendRules(campaignId: string | null) {
  return useQuery({
    queryKey: ['campaign-send-rules', campaignId],
    queryFn: async () => {
      if (!campaignId) return null;
      const { data, error } = await supabase
        .from('campaign_send_rules')
        .select('*')
        .eq('campaign_id', campaignId)
        .maybeSingle();
      if (error) throw error;
      return data as CampaignSendRules | null;
    },
    enabled: !!campaignId,
  });
}

// ── Mutations ────────────────────────────────────────────────────

export function useUpsertVariation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variation: Partial<CampaignVariation> & { campaign_id: string }) => {
      const payload = { ...variation, updated_at: new Date().toISOString() };
      if (variation.id) {
        const { data, error } = await supabase
          .from('campaign_variations')
          .update(payload)
          .eq('id', variation.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase
        .from('campaign_variations')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-variations', vars.campaign_id] });
      toast.success('Variação salva!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteVariation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const { error } = await supabase.from('campaign_variations').delete().eq('id', id);
      if (error) throw error;
      return campaignId;
    },
    onSuccess: (campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-variations', campaignId] });
      toast.success('Variação excluída');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSelectWinner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ variationId, campaignId }: { variationId: string; campaignId: string }) => {
      await supabase
        .from('campaign_variations')
        .update({ is_winner: false })
        .eq('campaign_id', campaignId);
      const { error } = await supabase
        .from('campaign_variations')
        .update({ is_winner: true, is_active: true })
        .eq('id', variationId);
      if (error) throw error;
      await supabase
        .from('campaign_variations')
        .update({ is_active: false })
        .eq('campaign_id', campaignId)
        .neq('id', variationId);
    },
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-variations', campaignId] });
      toast.success('Vencedor definido — apenas esta variação será usada.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useClearWinner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const { error } = await supabase
        .from('campaign_variations')
        .update({ is_winner: false, is_active: true })
        .eq('campaign_id', campaignId);
      if (error) throw error;
    },
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-variations', campaignId] });
      toast.success('Teste A/B retomado — todas as variações ativas.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpsertSendRules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rules: CampaignSendRules) => {
      const { data, error } = await supabase
        .from('campaign_send_rules')
        .upsert({ ...rules, updated_at: new Date().toISOString() }, { onConflict: 'campaign_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-send-rules', vars.campaign_id] });
      toast.success('Regras salvas!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
