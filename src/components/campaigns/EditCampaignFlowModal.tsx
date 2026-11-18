import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Step2FlowConfig } from '@/components/campaigns/wizard/Step2FlowConfig';
import type { CampaignFormData } from '@/pages/CreateCampaign';

interface Props {
  campaignId: string;
  flowConfig: Record<string, any>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

// Reaproveita o Step2FlowConfig do wizard de criação — já tem toda a edição
// de texto (mensagem WhatsApp/SMS, assunto+corpo de email, script de
// ligação) pronta, só faltava um jeito de abri-lo de novo numa campanha já
// criada. Antes disso, o texto configurado em cada dia só aparecia (e só
// dava pra editar) durante a criação; depois de criada, a campanha ficava
// sem nenhuma tela que mostrasse ou deixasse mudar esse texto.
export function EditCampaignFlowModal({ campaignId, flowConfig, open, onOpenChange, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  // Step2FlowConfig só lê flow_config e duration do objeto — os outros
  // campos de CampaignFormData não se aplicam aqui (edição pontual do
  // fluxo, não o wizard inteiro), mas o tipo exige o shape completo.
  const [draft, setDraft] = useState<CampaignFormData>({
    name: '',
    description: '',
    objective: '',
    duration: Object.keys(flowConfig || {}).length || 7,
    tags: [],
    flow_config: flowConfig || {},
    contacts: [],
    connection_id: null,
    pacing: {} as any,
    variations: [],
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('recurring_campaigns')
        .update({ flow_config: draft.flow_config } as any)
        .eq('id', campaignId);
      if (error) throw error;
      toast.success('Fluxo da campanha atualizado');
      onSaved();
      onOpenChange(false);
    } catch (err) {
      console.error('[EditCampaignFlowModal] Error saving flow_config:', err);
      toast.error('Erro ao salvar fluxo da campanha');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar fluxo da campanha</DialogTitle>
        </DialogHeader>

        <Step2FlowConfig data={draft} onChange={setDraft} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
