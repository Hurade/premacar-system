import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Building2, Phone, Mail, MapPin,
  Pencil, Trash2, ArrowLeft, ChevronRight, X, Save,
} from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLeads, useCreateLead, useUpdateLead, useDeleteLead } from '@/hooks/useLeads'
import type { Lead, TipoNegocio, OrigemLead, DorPrincipal } from '@/types/propostas'
import { TIPO_NEGOCIO_LABELS, ORIGEM_LABELS, DOR_LABELS } from '@/types/propostas'
import { cn } from '@/lib/utils'

const leadSchema = z.object({
  empresa: z.string().min(2, 'Nome da empresa obrigatório'),
  responsavel: z.string().min(2, 'Nome do responsável obrigatório'),
  telefone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  tipo_negocio: z.enum(['oficina', 'autocenter', 'rede', 'franquia', 'outro']),
  clientes_mes: z.coerce.number().optional(),
  clientes_base: z.coerce.number().optional(),
  erp_utilizado: z.string().optional(),
  origem: z.enum(['feira', 'indicacao', 'instagram', 'whatsapp', 'prospeccao', 'site', 'lista', 'outro']),
  dor_principal: z.enum(['cliente_nao_volta', 'falta_pos_venda', 'reclamacoes', 'baixa_fidelizacao', 'falta_controle', 'automatizar_whatsapp', 'outro']),
  observacoes: z.string().optional(),
})

type LeadForm = z.infer<typeof leadSchema>

function LeadFormDrawer({
  open, onClose, lead,
}: { open: boolean; onClose: () => void; lead?: Lead }) {
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()

  const form = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
    defaultValues: lead ? {
      empresa: lead.empresa,
      responsavel: lead.responsavel,
      telefone: lead.telefone,
      email: lead.email ?? '',
      cidade: lead.cidade ?? '',
      estado: lead.estado ?? '',
      tipo_negocio: lead.tipo_negocio,
      clientes_mes: lead.clientes_mes ?? undefined,
      clientes_base: lead.clientes_base ?? undefined,
      erp_utilizado: lead.erp_utilizado ?? '',
      origem: lead.origem,
      dor_principal: lead.dor_principal,
      observacoes: lead.observacoes ?? '',
    } : {
      tipo_negocio: 'autocenter',
      origem: 'prospeccao',
      dor_principal: 'cliente_nao_volta',
    },
  })

  async function onSubmit(values: LeadForm) {
    if (lead) {
      await updateLead.mutateAsync({
        id: lead.id,
        ...values,
        email: values.email || null,
        cidade: values.cidade || null,
        estado: values.estado || null,
        erp_utilizado: values.erp_utilizado || null,
        observacoes: values.observacoes || null,
        clientes_mes: values.clientes_mes ?? null,
        clientes_base: values.clientes_base ?? null,
      })
    } else {
      await createLead.mutateAsync({
        empresa: values.empresa,
        responsavel: values.responsavel,
        telefone: values.telefone,
        tipo_negocio: values.tipo_negocio,
        origem: values.origem,
        dor_principal: values.dor_principal,
        email: values.email || null,
        cidade: values.cidade || null,
        estado: values.estado || null,
        erp_utilizado: values.erp_utilizado || null,
        observacoes: values.observacoes || null,
        clientes_mes: values.clientes_mes ?? null,
        clientes_base: values.clientes_base ?? null,
        vendedor_id: null,
      })
    }
    onClose()
  }

  const F = form.register
  const err = form.formState.errors
  const isLoading = createLead.isPending || updateLead.isPending

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-card border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            {lead ? 'Editar Lead' : 'Novo Lead'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-1.5">
              <Label>Nome da Empresa *</Label>
              <Input {...F('empresa')} placeholder="Ex: Auto Center Silva" className="bg-muted/20 border-border/40" />
              {err.empresa && <p className="text-xs text-red-400">{err.empresa.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Responsável *</Label>
              <Input {...F('responsavel')} placeholder="João Silva" className="bg-muted/20 border-border/40" />
              {err.responsavel && <p className="text-xs text-red-400">{err.responsavel.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp *</Label>
              <Input {...F('telefone')} placeholder="(11) 99999-9999" className="bg-muted/20 border-border/40" />
              {err.telefone && <p className="text-xs text-red-400">{err.telefone.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input {...F('email')} type="email" placeholder="contato@empresa.com" className="bg-muted/20 border-border/40" />
              {err.email && <p className="text-xs text-red-400">{err.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input {...F('cidade')} placeholder="São Paulo" className="bg-muted/20 border-border/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Input {...F('estado')} placeholder="SP" maxLength={2} className="bg-muted/20 border-border/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de Negócio *</Label>
              <Select
                value={form.watch('tipo_negocio')}
                onValueChange={v => form.setValue('tipo_negocio', v as TipoNegocio)}
              >
                <SelectTrigger className="bg-muted/20 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_NEGOCIO_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ERP Utilizado</Label>
              <Input {...F('erp_utilizado')} placeholder="Ex: Oficina Web, AutoSoft..." className="bg-muted/20 border-border/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Clientes/mês (aprox.)</Label>
              <Input {...F('clientes_mes')} type="number" placeholder="500" className="bg-muted/20 border-border/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Clientes na base (aprox.)</Label>
              <Input {...F('clientes_base')} type="number" placeholder="3000" className="bg-muted/20 border-border/40" />
            </div>
            <div className="space-y-1.5">
              <Label>Origem do Lead *</Label>
              <Select
                value={form.watch('origem')}
                onValueChange={v => form.setValue('origem', v as OrigemLead)}
              >
                <SelectTrigger className="bg-muted/20 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ORIGEM_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Dor Principal *</Label>
              <Select
                value={form.watch('dor_principal')}
                onValueChange={v => form.setValue('dor_principal', v as DorPrincipal)}
              >
                <SelectTrigger className="bg-muted/20 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOR_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>Observações Comerciais</Label>
              <Textarea
                {...F('observacoes')}
                placeholder="Anotações importantes sobre o lead, contexto da conversa, etc."
                rows={3}
                className="bg-muted/20 border-border/40 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              <X className="w-4 h-4 mr-1.5" />
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90 text-white">
              <Save className="w-4 h-4 mr-1.5" />
              {isLoading ? 'Salvando...' : lead ? 'Atualizar' : 'Cadastrar Lead'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function LeadCard({ lead, onEdit, onDelete, onNewProposta }: {
  lead: Lead
  onEdit: () => void
  onDelete: () => void
  onNewProposta: () => void
}) {
  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5 hover:border-primary/20 transition-all group">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4.5 h-4.5 w-[18px] h-[18px] text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{lead.empresa}</p>
            <p className="text-xs text-muted-foreground">{TIPO_NEGOCIO_LABELS[lead.tipo_negocio]}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Phone className="w-3 h-3" />
          <span>{lead.responsavel} — {lead.telefone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="w-3 h-3" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.cidade && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span>{lead.cidade}{lead.estado ? ` — ${lead.estado}` : ''}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs mb-4">
        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">{ORIGEM_LABELS[lead.origem]}</span>
        <span className="bg-muted/40 text-muted-foreground px-2 py-0.5 rounded-full truncate">
          {DOR_LABELS[lead.dor_principal]}
        </span>
      </div>

      <Button
        size="sm"
        onClick={onNewProposta}
        className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 gap-1.5"
        variant="ghost"
      >
        Criar Proposta
        <ChevronRight className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

export default function Leads() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | undefined>()

  const { data: leads = [], isLoading } = useLeads(search)
  const deleteLead = useDeleteLead()

  function handleDelete(id: string) {
    if (confirm('Tem certeza que deseja remover este lead?')) {
      deleteLead.mutate(id)
    }
  }

  function handleEdit(lead: Lead) {
    setEditingLead(lead)
    setShowForm(true)
  }

  function handleCloseForm() {
    setShowForm(false)
    setEditingLead(undefined)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/propostas')} className="p-2 rounded-xl hover:bg-muted/50 transition-colors">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Leads</h1>
              <p className="text-sm text-muted-foreground">
                {leads.length} lead{leads.length !== 1 ? 's' : ''} cadastrado{leads.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button onClick={() => setShowForm(true)} className="gap-2 bg-primary hover:bg-primary/90 text-white">
            <Plus className="w-4 h-4" />
            Novo Lead
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-muted/20 border-border/40"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-card/40 animate-pulse rounded-2xl border border-border/30" />
            ))}
          </div>
        ) : leads.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {leads.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onEdit={() => handleEdit(lead)}
                onDelete={() => handleDelete(lead.id)}
                onNewProposta={() => navigate('/propostas/nova', { state: { leadId: lead.id } })}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <p className="text-foreground font-semibold">Nenhum lead encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Comece cadastrando o primeiro lead</p>
            <Button onClick={() => setShowForm(true)} className="mt-4 bg-primary hover:bg-primary/90 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Novo Lead
            </Button>
          </div>
        )}
      </div>

      <LeadFormDrawer open={showForm} onClose={handleCloseForm} lead={editingLead} />
    </div>
  )
}
