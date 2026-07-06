import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TeamMemberSchedule {
  id: string;
  team_member_id: string;
  day_of_week: number; // 0=domingo ... 6=sábado
  start_time: string; // HH:MM:SS
  end_time: string;
  is_available: boolean;
}

// team_member_schedules ainda não está no types.ts gerado (tabela nova).
const db = () => supabase as any;

export function useTeamMemberSchedules(teamMemberId: string | undefined) {
  return useQuery({
    queryKey: ['team_member_schedules', teamMemberId],
    queryFn: async () => {
      if (!teamMemberId) return [];
      const { data, error } = await db()
        .from('team_member_schedules')
        .select('*')
        .eq('team_member_id', teamMemberId)
        .order('day_of_week', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamMemberSchedule[];
    },
    enabled: !!teamMemberId,
  });
}

export function useUpsertTeamMemberSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      teamMemberId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isAvailable: boolean;
    }) => {
      const { error } = await db().from('team_member_schedules').upsert(
        {
          team_member_id: input.teamMemberId,
          day_of_week: input.dayOfWeek,
          start_time: input.startTime,
          end_time: input.endTime,
          is_available: input.isAvailable,
        },
        { onConflict: 'team_member_id,day_of_week' }
      );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['team_member_schedules', variables.teamMemberId] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar horário: ${error.message || error}`);
    },
  });
}
