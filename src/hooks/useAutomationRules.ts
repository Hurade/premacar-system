import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AutomationTriggerType = 'new_message' | 'tag_applied' | 'stage_changed';
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty';

export interface AutomationCondition {
  field: string;
  operator: ConditionOperator;
  value: string;
}

export interface AutomationAction {
  type: 'send_message' | 'apply_tag' | 'remove_tag' | 'move_stage' | 'create_task';
  params: Record<string, string>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: AutomationTriggerType;
  trigger_config: Record<string, string>;
  conditions: AutomationCondition[];
  conditions_logic: 'AND' | 'OR';
  actions: AutomationAction[];
  priority: number;
  run_once_per_contact: boolean;
  created_at: string;
}

// automation_rules ainda não está no types.ts gerado (tabela nova).
const db = () => supabase as any;

export function useAutomationRules() {
  return useQuery({
    queryKey: ['automation_rules'],
    queryFn: async () => {
      const { data, error } = await db()
        .from('automation_rules')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as AutomationRule[];
    },
  });
}

export function useSaveAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Partial<AutomationRule> & { id?: string }) => {
      const { id, ...rest } = rule;
      if (id) {
        const { error } = await db().from('automation_rules').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await db().from('automation_rules').insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation_rules'] });
      toast.success('Automação salva');
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar automação: ${error.message || error}`);
    },
  });
}

export function useToggleAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await db().from('automation_rules').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation_rules'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar automação: ${error.message || error}`);
    },
  });
}

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('automation_rules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation_rules'] });
      toast.success('Automação removida');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover automação: ${error.message || error}`);
    },
  });
}
