import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

// Fetch all templates
export function useMessageTemplates() {
  return useQuery({
    queryKey: ['message-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Parse JSONB fields
      return (data ?? []).map(template => ({
        ...template,
        variations: template.variations as string[],
        media_urls: template.media_urls as string[],
      })) as MessageTemplate[];
    },
  });
}

// Create template
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: Partial<MessageTemplate>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const insertData = {
        name: template.name || 'Novo Modelo',
        user_id: user.id,
        variations: template.variations ?? [],
        media_urls: template.media_urls ?? [],
        media_type: template.media_type ?? 'none',
      };

      const { data, error } = await supabase
        .from('message_templates')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Modelo criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar modelo: ${error.message}`);
    },
  });
}

// Update template
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MessageTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from('message_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Modelo atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar modelo: ${error.message}`);
    },
  });
}

// Delete template
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] });
      toast.success('Modelo excluído com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir modelo: ${error.message}`);
    },
  });
}
