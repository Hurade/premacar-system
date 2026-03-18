import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MessageSquarePlus, Clock, Tag, Info, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

// ─── Schema ─────────────────────────────────────────────────────────────────
const schema = z.object({
  is_active: z.boolean(),
  message: z.string().min(1, 'Mensagem obrigatória'),
  delay_hours: z.coerce.number().int().min(1, 'Mínimo 1h').max(23, 'Máximo 23h'),
  tag_name: z.string().min(1, 'Nome da tag obrigatório'),
});

type FormValues = z.infer<typeof schema>;

// ─── Types ───────────────────────────────────────────────────────────────────
interface FollowupSettings {
  id?: string;
  is_active: boolean;
  message: string;
  delay_hours: number;
  tag_name: string;
}

interface SystemLog {
  id: string;
  created_at: string;
  message: string;
  level: string;
  metadata: Record<string, unknown> | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// ─── WhatsApp Preview ─────────────────────────────────────────────────────────
function WhatsAppPreview({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-[#0b1419] p-4 min-h-24 flex items-end">
      <div
        className="max-w-xs rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-white relative"
        style={{ background: '#005c4b' }}
      >
        <p className="whitespace-pre-wrap leading-relaxed">
          {message || <span className="text-white/40 italic">Sua mensagem aparecerá aqui…</span>}
        </p>
        <span className="text-[10px] text-white/50 float-right mt-1 ml-4">
          {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Followup() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      is_active: false,
      message: '',
      delay_hours: 20,
      tag_name: 'FOLLOW-UP',
    },
  });

  const isActive = watch('is_active');
  const message = watch('message');

  // ── Fetch settings ──────────────────────────────────────────────────────────
  const { data: settings, isLoading } = useQuery({
    queryKey: ['followup-settings'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('followup_settings')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      if (error) throw error;
      return data as FollowupSettings | null;
    },
    enabled: !!user?.id,
    staleTime: 60_000,
  });

  // Populate form when settings load
  useEffect(() => {
    if (settings) {
      reset({
        is_active: settings.is_active,
        message: settings.message,
        delay_hours: settings.delay_hours,
        tag_name: settings.tag_name,
      });
    }
  }, [settings, reset]);

  // ── Save mutation ───────────────────────────────────────────────────────────
  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = { ...values, user_id: user!.id };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('followup_settings')
        .upsert(
          settings?.id ? { id: settings.id, ...payload } : payload,
          { onConflict: 'user_id' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configuração salva!');
      queryClient.invalidateQueries({ queryKey: ['followup-settings'] });
    },
    onError: (err: Error) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  // ── Recent logs ─────────────────────────────────────────────────────────────
  const { data: logs = [], refetch: refetchLogs, dataUpdatedAt } = useQuery({
    queryKey: ['followup-logs'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from('system_logs')
        .select('id, created_at, message, level, metadata')
        .eq('source', 'followup-processor')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as SystemLog[];
    },
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
          <MessageSquarePlus className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Follow-up Automático</h1>
          <p className="text-sm text-muted-foreground">
            Reengaja contatos antes da janela de 24h expirar
          </p>
        </div>
        <div className="ml-auto">
          <Badge
            className={
              isActive
                ? 'bg-green-500/20 text-green-400 border-green-500/30 border'
                : 'bg-slate-500/20 text-slate-400 border-slate-500/30 border'
            }
          >
            {isActive ? 'Ativo' : 'Pausado'}
          </Badge>
        </div>
      </div>

      {/* Info card */}
      <div className="flex gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Quando um cliente envia uma mensagem e não responde após o tempo configurado, o sistema
          envia automaticamente esta mensagem antes da janela de 24h expirar. Cada contato recebe
          apenas 1 follow-up por conversa — a tag de controle é removida quando a janela expira.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit((v) => save.mutate(v))} className="space-y-5">
        {/* Toggle */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
          <div>
            <p className="font-medium text-foreground">Ativar follow-up automático</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Processa conversas a cada 30 minutos
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={(v) => setValue('is_active', v)}
          />
        </div>

        {/* Delay + Tag */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Clock className="w-3.5 h-3.5" />
              Enviar após (horas)
            </Label>
            <Input
              type="number"
              min={1}
              max={23}
              className="bg-card border-border"
              {...register('delay_hours')}
            />
            {errors.delay_hours && (
              <p className="text-xs text-red-400">{errors.delay_hours.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <Tag className="w-3.5 h-3.5" />
              Tag de controle
            </Label>
            <Input
              className="bg-card border-border"
              placeholder="FOLLOW-UP"
              {...register('tag_name')}
            />
            {errors.tag_name && (
              <p className="text-xs text-red-400">{errors.tag_name.message}</p>
            )}
          </div>
        </div>

        {/* Message + Preview side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Mensagem de follow-up</Label>
            <Textarea
              rows={6}
              className="bg-card border-border resize-none"
              placeholder="Oi {nome}! Passando para ver se você tem alguma dúvida…"
              {...register('message')}
            />
            {errors.message && (
              <p className="text-xs text-red-400">{errors.message.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-muted-foreground text-xs">Preview</Label>
            <WhatsAppPreview message={message} />
          </div>
        </div>

        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? 'Salvando…' : 'Salvar configuração'}
        </Button>
      </form>

      {/* Recent logs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Últimos follow-ups enviados</h2>
            {dataUpdatedAt > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Atualizado às{' '}
                {new Date(dataUpdatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchLogs()} className="gap-2 h-8">
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </Button>
        </div>

        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum follow-up enviado ainda.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border"
              >
                {log.level === 'info' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{log.message}</p>
                  {log.metadata && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {log.metadata.phone as string}
                      {log.metadata.contact_name ? ` · ${log.metadata.contact_name}` : ''}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {formatDate(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
