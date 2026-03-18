import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface MetaTemplate {
  id: string;
  user_id: string;
  name: string;
  display_name: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language_code: string;
  status: 'pending' | 'approved' | 'rejected';
  header_text: string | null;
  body_text: string;
  footer_text: string | null;
  parameters_count: number;
  parameters_mapping: Array<{ index: number; field: string }>;
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MetaTemplateInsert {
  name: string;
  display_name: string;
  category?: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language_code?: string;
  status?: 'pending' | 'approved' | 'rejected';
  header_text?: string | null;
  body_text: string;
  footer_text?: string | null;
  parameters_count?: number;
  parameters_mapping?: Array<{ index: number; field: string }>;
}

// Fetch all meta templates
export function useMetaTemplates() {
  return useQuery({
    queryKey: ['meta-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Type assertion since the table is new and types.ts may not be updated yet
      return data as unknown as MetaTemplate[];
    },
  });
}

// Fetch only approved meta templates
export function useApprovedMetaTemplates() {
  return useQuery({
    queryKey: ['meta-templates', 'approved'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_templates')
        .select('*')
        .eq('status', 'approved')
        .order('display_name');

      if (error) throw error;
      
      return data as unknown as MetaTemplate[];
    },
  });
}

// Create meta template
export function useCreateMetaTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: MetaTemplateInsert) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Count parameters in body_text ({{1}}, {{2}}, etc.)
      const parameterMatches = template.body_text.match(/\{\{\d+\}\}/g);
      const parametersCount = parameterMatches ? new Set(parameterMatches).size : 0;

      const { data, error } = await supabase
        .from('meta_templates')
        .insert({
          user_id: user.id,
          name: template.name,
          display_name: template.display_name,
          category: template.category || 'MARKETING',
          language_code: template.language_code || 'pt_BR',
          status: template.status || 'pending',
          header_text: template.header_text || null,
          body_text: template.body_text,
          footer_text: template.footer_text || null,
          parameters_count: parametersCount,
          parameters_mapping: template.parameters_mapping || [],
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-templates'] });
      toast.success('Template Meta criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar template: ${error.message}`);
    },
  });
}

// Update meta template
export function useUpdateMetaTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MetaTemplate> & { id: string }) => {
      // Recalculate parameters count if body_text changed
      let parametersCount = updates.parameters_count;
      if (updates.body_text) {
        const parameterMatches = updates.body_text.match(/\{\{\d+\}\}/g);
        parametersCount = parameterMatches ? new Set(parameterMatches).size : 0;
      }

      const { data, error } = await supabase
        .from('meta_templates')
        .update({
          ...updates,
          parameters_count: parametersCount,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-templates'] });
      toast.success('Template Meta atualizado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar template: ${error.message}`);
    },
  });
}

// Delete meta template
export function useDeleteMetaTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error, count } = await supabase
        .from('meta_templates')
        .delete({ count: 'exact' })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      if (count === 0) throw new Error('Template não encontrado ou sem permissão');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-templates'] });
      toast.success('Template Meta excluído!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir template: ${error.message}`);
    },
  });
}

// Approve meta template (for testing/manual approval)
export function useApproveMetaTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('meta_templates')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-templates'] });
      toast.success('Template aprovado!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao aprovar template: ${error.message}`);
    },
  });
}

// Test send template to a single number
export function useTestMetaTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, phoneNumber }: { templateId: string; phoneNumber: string }) => {
      const { data, error } = await supabase.functions.invoke('test-meta-template', {
        body: { templateId, phoneNumber }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Template de teste enviado! Verifique seu WhatsApp.');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar teste: ${error.message}`);
    },
  });
}