import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCustomFieldDefinitions, type CustomFieldDefinition } from './useCustomFieldDefinitions';

export interface ContactCustomFieldValue {
  id: string;
  contact_id: string;
  field_id: string;
  value: string | null;
}

const db = () => supabase as any;

export function useContactCustomFields(contactId: string | undefined) {
  const { data: definitions, isLoading: definitionsLoading } = useCustomFieldDefinitions(true);

  const valuesQuery = useQuery({
    queryKey: ['contact_custom_field_values', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await db()
        .from('contact_custom_field_values')
        .select('*')
        .eq('contact_id', contactId);
      if (error) throw error;
      return (data ?? []) as ContactCustomFieldValue[];
    },
    enabled: !!contactId,
  });

  const fields = (definitions || []).map((def: CustomFieldDefinition) => ({
    definition: def,
    value: valuesQuery.data?.find((v) => v.field_id === def.id)?.value ?? '',
  }));

  return {
    fields,
    isLoading: definitionsLoading || valuesQuery.isLoading,
  };
}

export function useUpsertContactCustomFieldValue() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ contactId, fieldId, value }: { contactId: string; fieldId: string; value: string }) => {
      const { error } = await db()
        .from('contact_custom_field_values')
        .upsert({ contact_id: contactId, field_id: fieldId, value }, { onConflict: 'contact_id,field_id' });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contact_custom_field_values', variables.contactId] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao salvar campo: ${error.message || error}`);
    },
  });
}
