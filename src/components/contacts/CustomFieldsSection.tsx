import React, { useEffect, useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { useContactCustomFields, useUpsertContactCustomFieldValue } from '@/hooks/useContactCustomFields';

interface CustomFieldsSectionProps {
  contactId: string;
}

export function CustomFieldsSection({ contactId }: CustomFieldsSectionProps) {
  const { fields, isLoading } = useContactCustomFields(contactId);
  const upsertMutation = useUpsertContactCustomFieldValue();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  useEffect(() => {
    const next: Record<string, string> = {};
    fields.forEach((f) => { next[f.definition.id] = f.value; });
    setLocalValues(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fields.map((f) => `${f.definition.id}:${f.value}`).join('|')]);

  if (isLoading || fields.length === 0) return null;

  const handleBlur = (fieldId: string) => {
    const value = localValues[fieldId] ?? '';
    const original = fields.find((f) => f.definition.id === fieldId)?.value ?? '';
    if (value !== original) {
      upsertMutation.mutate({ contactId, fieldId, value });
    }
  };

  return (
    <div className="space-y-4 pt-2 border-t border-slate-800">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Campos Personalizados</p>
      {fields.map(({ definition }) => (
        <div key={definition.id} className="space-y-2">
          <Label htmlFor={`custom-field-${definition.id}`}>
            {definition.nome}
            {definition.obrigatorio && <span className="text-red-400 ml-1">*</span>}
          </Label>
          {definition.tipo === 'select' ? (
            <select
              id={`custom-field-${definition.id}`}
              value={localValues[definition.id] ?? ''}
              onChange={(e) => setLocalValues((prev) => ({ ...prev, [definition.id]: e.target.value }))}
              onBlur={() => handleBlur(definition.id)}
              className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm text-slate-200"
            >
              <option value="">Selecione...</option>
              {definition.opcoes.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <Input
              id={`custom-field-${definition.id}`}
              type={definition.tipo === 'numero' ? 'number' : definition.tipo === 'data' ? 'date' : 'text'}
              value={localValues[definition.id] ?? ''}
              onChange={(e) => setLocalValues((prev) => ({ ...prev, [definition.id]: e.target.value }))}
              onBlur={() => handleBlur(definition.id)}
              className="bg-slate-950 border-slate-800"
            />
          )}
        </div>
      ))}
    </div>
  );
}
