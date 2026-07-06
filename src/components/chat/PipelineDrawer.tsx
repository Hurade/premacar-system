import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KanbanSquare, Loader2 } from 'lucide-react';
import { CreateDealModal } from '@/components/CreateDealModal';
import { DealProductsPanel } from '@/components/deals/DealProductsPanel';

// ─── Schema ──────────────────────────────────────────────────────────────────
const dealSchema = z.object({
  title: z.string().min(1, 'Título obrigatório'),
  company: z.string().optional(),
  value: z.coerce.number().min(0).default(0),
  stage_id: z.string().min(1, 'Estágio obrigatório'),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  owner_id: z.string().optional(),
  due_date: z.string().optional(),
  tags: z.string().optional(),
});

type DealForm = z.infer<typeof dealSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────
interface PipelineDrawerProps {
  open: boolean;
  onClose: () => void;
  contactId: string;
  contactName: string;
  teamMembers: { id: string; name: string; role: string; status?: string }[];
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PipelineDrawer({
  open,
  onClose,
  contactId,
  contactName,
  teamMembers,
}: PipelineDrawerProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch deal for this contact
  const { data: deal, isLoading: dealLoading } = useQuery({
    queryKey: ['deal', contactId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*, pipeline_stages(*)')
        .eq('contact_id', contactId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open && !!contactId,
  });

  // Fetch pipeline stages
  const { data: stages = [] } = useQuery({
    queryKey: ['pipeline-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipeline_stages')
        .select('id, title, color, position')
        .order('position');
      if (error) throw error;
      return data || [];
    },
    enabled: open,
    staleTime: 60_000,
  });

  // Form — values stay in sync with deal
  const { register, handleSubmit, formState: { errors } } = useForm<DealForm>({
    resolver: zodResolver(dealSchema),
    values: deal
      ? {
          title: deal.title || '',
          company: deal.company || '',
          value: deal.value ?? 0,
          stage_id: deal.stage_id || '',
          priority: (deal.priority as 'low' | 'medium' | 'high') || 'medium',
          owner_id: deal.owner_id || '',
          due_date: deal.due_date ? deal.due_date.substring(0, 10) : '',
          tags: deal.tags ? (deal.tags as string[]).join(', ') : '',
        }
      : { title: '', company: '', value: 0, stage_id: '', priority: 'medium', owner_id: '', due_date: '', tags: '' },
  });

  // Save deal mutation
  const saveDeal = useMutation({
    mutationFn: async (values: DealForm) => {
      if (!deal?.id) throw new Error('Nenhum deal para salvar');
      const { error } = await supabase
        .from('deals')
        .update({
          title: values.title,
          company: values.company || null,
          value: values.value,
          stage_id: values.stage_id,
          priority: values.priority,
          owner_id: values.owner_id || null,
          due_date: values.due_date || null,
          tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', deal.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Deal atualizado!');
      queryClient.invalidateQueries({ queryKey: ['deal', contactId] });
    },
    onError: (err: Error) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  const selectClass =
    'w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-cyan-500 outline-none';

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent
          side="right"
          className="w-[440px] max-w-full bg-slate-900 border-slate-700 text-white overflow-y-auto"
        >
          <SheetHeader className="border-b border-slate-800 pb-4 mb-2">
            <SheetTitle className="text-white flex items-center gap-2 text-base">
              <KanbanSquare className="w-5 h-5 text-cyan-500" />
              Pipeline — {contactName}
            </SheetTitle>
          </SheetHeader>

          {dealLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-500" />
            </div>
          ) : deal ? (
            /* ── Edit form ── */
            <form onSubmit={handleSubmit((v) => saveDeal.mutate(v))} className="space-y-4 pt-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Título</Label>
                <Input className="bg-slate-800 border-slate-700 text-slate-200" {...register('title')} />
                {errors.title && <p className="text-xs text-red-400">{errors.title.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Empresa</Label>
                <Input className="bg-slate-800 border-slate-700 text-slate-200" {...register('company')} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Valor (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="bg-slate-800 border-slate-700 text-slate-200"
                  {...register('value')}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Estágio</Label>
                <select className={selectClass} {...register('stage_id')}>
                  <option value="">Selecionar estágio…</option>
                  {(stages as { id: string; title: string }[]).map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
                {errors.stage_id && <p className="text-xs text-red-400">{errors.stage_id.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Prioridade</Label>
                <select className={selectClass} {...register('priority')}>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Responsável</Label>
                <select className={selectClass} {...register('owner_id')}>
                  <option value="">Automático (Round-Robin)</option>
                  {teamMembers
                    .filter((m) => !m.status || m.status === 'active')
                    .map((m) => (
                    <option key={m.id} value={m.id}>{m.name} ({m.role})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 border-t border-slate-800 pt-4">
                <DealProductsPanel dealId={deal.id} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Data prevista</Label>
                <input
                  type="date"
                  className={selectClass}
                  {...register('due_date')}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Tags (separadas por vírgula)</Label>
                <Input
                  placeholder="ex: vip, urgente"
                  className="bg-slate-800 border-slate-700 text-slate-200"
                  {...register('tags')}
                />
              </div>

              <Button type="submit" disabled={saveDeal.isPending} className="w-full mt-2">
                {saveDeal.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando…</>
                ) : (
                  'Salvar alterações'
                )}
              </Button>
            </form>
          ) : (
            /* ── No deal ── */
            <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-6">
              <div className="w-14 h-14 rounded-full bg-slate-800 flex items-center justify-center">
                <KanbanSquare className="w-7 h-7 text-slate-500" />
              </div>
              <div>
                <p className="text-sm text-slate-300 font-medium">
                  Nenhum deal encontrado para este contato
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Crie um deal para acompanhar no pipeline
                </p>
              </div>
              <Button type="button" onClick={() => setShowCreateModal(true)} className="gap-2">
                Criar Deal
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CreateDealModal
        open={showCreateModal}
        onOpenChange={(v) => {
          setShowCreateModal(v);
          if (!v) queryClient.invalidateQueries({ queryKey: ['deal', contactId] });
        }}
        onDealCreated={() => {
          setShowCreateModal(false);
          queryClient.invalidateQueries({ queryKey: ['deal', contactId] });
        }}
      />
    </>
  );
}
