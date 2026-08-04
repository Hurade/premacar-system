import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, ArrowRight, Check, Building2, Sparkles, Presentation, Plus, Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCRMContacts, useLeadFromContact, useCreateLead, useLead, type CRMContact } from '@/hooks/useLeads'
import { useCreateApresentacao, useApresentacaoTemplates } from '@/hooks/useApresentacoes'
import type { Lead, TipoNegocio, OrigemLead, DorPrincipal } from '@/types/propostas'
import { TIPO_NEGOCIO_LABELS, ORIGEM_LABELS, DOR_LABELS } from '@/types/propostas'
import type { AssinaturaVendedor } from '@/types/apresentacoes'
import { ParceirosComerciaisDeck } from '@/components/apresentacoes/decks/parceiros-comerciais'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Lead', icon: Building2, desc: 'Selecione ou cadastre o lead' },
  { id: 2, label: 'Personalizar & Gerar', icon: Sparkles, desc: 'Ajuste os detalhes e revise a prévia' },
]

const leadSchema = z.object({
  empresa: z.string().min(2),
  responsavel: z.string().min(2),
  telefone: z.string().min(10),
  email: z.string().email().optional().or(z.literal('')),
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

// ─── Passo 1: Selecionar Lead (mesmo padrão do wizard de Propostas) ─────────
function Step1Lead({
  selectedLead, onSelectLead,
}: { selectedLead: Lead | null; onSelectLead: (l: Lead) => void }) {
  const [search, setSearch] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [loadingContactId, setLoadingContactId] = useState<string | null>(null)

  const { data: contacts = [], isLoading: contactsLoading } = useCRMContacts(search)
  const leadFromContact = useLeadFromContact()
  const createLead = useCreateLead()

  const form = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
    defaultValues: { tipo_negocio: 'autocenter', origem: 'prospeccao', dor_principal: 'cliente_nao_volta' },
  })
  const F = form.register

  async function handleSelectContact(contact: CRMContact) {
    setLoadingContactId(contact.id)
    try {
      const lead = await leadFromContact.mutateAsync(contact)
      onSelectLead(lead)
    } finally {
      setLoadingContactId(null)
    }
  }

  async function handleCreate(values: LeadForm) {
    const lead = await createLead.mutateAsync({
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
    onSelectLead(lead)
    setShowNew(false)
  }

  if (showNew) {
    const err = form.formState.errors
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-muted/50">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-foreground">Cadastrar novo lead</h3>
        </div>
        <form onSubmit={form.handleSubmit(handleCreate)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Empresa *</Label>
            <Input {...F('empresa')} placeholder="Auto Center Silva" className="bg-muted/20 border-border/40" />
            {err.empresa && <p className="text-xs text-red-400">{err.empresa.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Responsável *</Label>
            <Input {...F('responsavel')} placeholder="João Silva" className="bg-muted/20 border-border/40" />
          </div>
          <div className="space-y-1">
            <Label>Telefone *</Label>
            <Input {...F('telefone')} placeholder="(11) 99999-9999" className="bg-muted/20 border-border/40" />
          </div>
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input {...F('email')} type="email" className="bg-muted/20 border-border/40" />
          </div>
          <div className="space-y-1">
            <Label>Cidade / Estado</Label>
            <div className="flex gap-2">
              <Input {...F('cidade')} placeholder="São Paulo" className="bg-muted/20 border-border/40 flex-1" />
              <Input {...F('estado')} placeholder="SP" maxLength={2} className="bg-muted/20 border-border/40 w-16" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Tipo de Negócio *</Label>
            <Select value={form.watch('tipo_negocio')} onValueChange={v => form.setValue('tipo_negocio', v as TipoNegocio)}>
              <SelectTrigger className="bg-muted/20 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TIPO_NEGOCIO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Origem *</Label>
            <Select value={form.watch('origem')} onValueChange={v => form.setValue('origem', v as OrigemLead)}>
              <SelectTrigger className="bg-muted/20 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ORIGEM_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Dor Principal *</Label>
            <Select value={form.watch('dor_principal')} onValueChange={v => form.setValue('dor_principal', v as DorPrincipal)}>
              <SelectTrigger className="bg-muted/20 border-border/40"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(DOR_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Button type="submit" disabled={createLead.isPending} className="w-full bg-primary hover:bg-primary/90 text-white">
              {createLead.isPending ? 'Salvando...' : 'Cadastrar e continuar'}
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar contato..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-muted/20 border-border/40" />
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {contactsLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">Carregando contatos...</p>
        )}
        {!contactsLoading && contacts.map(contact => {
          const label = contact.oficina || contact.name || contact.phone_number
          const sub = contact.name && contact.oficina ? contact.name : contact.phone_number
          const isSelecting = loadingContactId === contact.id
          const isSelected = selectedLead?.telefone === contact.phone_number
          return (
            <button
              key={contact.id}
              onClick={() => handleSelectContact(contact)}
              disabled={isSelecting || leadFromContact.isPending}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all disabled:opacity-60',
                isSelected ? 'border-primary bg-primary/10' : 'border-border/40 hover:border-primary/30 hover:bg-muted/20',
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              {isSelecting && <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin flex-shrink-0" />}
              {isSelected && !isSelecting && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
            </button>
          )
        })}
        {!contactsLoading && contacts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {search ? 'Nenhum contato encontrado' : 'Nenhum contato cadastrado no CRM'}
          </p>
        )}
      </div>

      <button
        onClick={() => setShowNew(true)}
        className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-all text-sm"
      >
        <Plus className="w-4 h-4" />
        Cadastrar novo lead (não está no CRM)
      </button>
    </div>
  )
}

// ─── Passo 2: Personalizar & Gerar ───────────────────────────────────────────
function Step2Personalizar({
  templateId, onTemplateId, templates,
  tituloPersonalizado, onTitulo,
  assinatura, onAssinatura,
  validadeDias, onValidade,
  empresa, responsavel,
}: {
  templateId: string | null
  onTemplateId: (id: string) => void
  templates: { id: string; nome: string }[]
  tituloPersonalizado: string
  onTitulo: (v: string) => void
  assinatura: AssinaturaVendedor
  onAssinatura: (a: AssinaturaVendedor) => void
  validadeDias: number
  onValidade: (v: number) => void
  empresa?: string
  responsavel?: string
}) {
  return (
    <div className="space-y-5">
      {templates.length > 1 && (
        <div className="space-y-1.5">
          <Label>Template</Label>
          <Select value={templateId ?? ''} onValueChange={onTemplateId}>
            <SelectTrigger className="bg-muted/20 border-border/40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Subtítulo personalizado (opcional)</Label>
        <Input
          value={tituloPersonalizado}
          onChange={e => onTitulo(e.target.value)}
          placeholder={`Preparado especialmente para ${responsavel ?? '...'}${responsavel && empresa ? ' — ' : ''}${empresa ?? ''}`}
          className="bg-muted/20 border-border/40"
        />
        <p className="text-xs text-muted-foreground">Se deixar em branco, usamos "Preparado especialmente para {responsavel || '[responsável]'} — {empresa || '[empresa]'}".</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Seu nome</Label>
          <Input value={assinatura.nome} onChange={e => onAssinatura({ ...assinatura, nome: e.target.value })} placeholder="Marco Silva" className="bg-muted/20 border-border/40" />
        </div>
        <div className="space-y-1.5">
          <Label>Cargo</Label>
          <Input value={assinatura.cargo} onChange={e => onAssinatura({ ...assinatura, cargo: e.target.value })} placeholder="Consultor Comercial" className="bg-muted/20 border-border/40" />
        </div>
        <div className="space-y-1.5">
          <Label>Telefone</Label>
          <Input value={assinatura.telefone} onChange={e => onAssinatura({ ...assinatura, telefone: e.target.value })} placeholder="(11) 99999-9999" className="bg-muted/20 border-border/40" />
        </div>
        <div className="space-y-1.5">
          <Label>E-mail</Label>
          <Input value={assinatura.email} onChange={e => onAssinatura({ ...assinatura, email: e.target.value })} placeholder="marco@premacar.com.br" className="bg-muted/20 border-border/40" />
        </div>
      </div>

      <div className="space-y-1.5 max-w-[160px]">
        <Label>Validade (dias)</Label>
        <Input type="number" value={validadeDias} onChange={e => onValidade(Number(e.target.value) || 30)} className="bg-muted/20 border-border/40" />
      </div>

      <div className="space-y-1.5">
        <Label>Prévia</Label>
        <div className="border border-border/40 rounded-xl overflow-hidden max-h-[420px] overflow-y-auto">
          <ParceirosComerciaisDeck
            empresa={empresa}
            responsavel={responsavel}
            tituloPersonalizado={tituloPersonalizado || null}
            assinaturaVendedor={assinatura.nome ? assinatura : null}
          />
        </div>
      </div>
    </div>
  )
}

export default function NovaApresentacaoWizard() {
  const navigate = useNavigate()
  const location = useLocation()
  const preselectedId = (location.state as { leadId?: string })?.leadId
  const createApresentacao = useCreateApresentacao()
  const { data: templates = [] } = useApresentacaoTemplates()

  const [step, setStep] = useState(1)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [tituloPersonalizado, setTituloPersonalizado] = useState('')
  const [assinatura, setAssinatura] = useState<AssinaturaVendedor>({ nome: '', cargo: '', telefone: '', email: '' })
  const [validadeDias, setValidadeDias] = useState(30)

  const { data: preselectedLead } = useLead(preselectedId)

  // Template ativo padrão: seleciona o primeiro assim que a lista carrega
  useEffect(() => {
    if (templates.length > 0 && !templateId) setTemplateId(templates[0].id)
  }, [templates, templateId])

  // Lead pré-selecionado a partir de /propostas/leads ("Criar Apresentação")
  useEffect(() => {
    if (preselectedLead && !selectedLead) setSelectedLead(preselectedLead)
  }, [preselectedLead, selectedLead])

  function handleNext() {
    setStep(s => Math.min(s + 1, 2))
  }

  function handleBack() {
    setStep(s => Math.max(s - 1, 1))
  }

  async function handleCreate() {
    if (!selectedLead) return
    const apresentacao = await createApresentacao.mutateAsync({
      lead_id: selectedLead.id,
      empresa: selectedLead.empresa,
      template_id: templateId,
      titulo_personalizado: tituloPersonalizado || null,
      assinatura_vendedor: assinatura.nome ? assinatura : null,
      validade_dias: validadeDias,
    })

    navigate(`/apresentacoes/${apresentacao.id}`)
  }

  const canNext = step === 1 ? !!selectedLead : true

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Voltar" onClick={() => navigate('/apresentacoes')} className="p-2 rounded-xl hover:bg-muted/50">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Nova Apresentação</h1>
            <p className="text-xs text-muted-foreground">Passo {step} de 2</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2 flex-1">
              <div className={cn(
                'flex items-center gap-2 flex-1 p-2.5 rounded-xl border text-xs transition-all',
                step === s.id ? 'border-primary bg-primary/10 text-primary' : '',
                step > s.id ? 'border-green-500/30 bg-green-500/5 text-green-400' : '',
                step < s.id ? 'border-border/30 text-muted-foreground' : '',
              )}>
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                  step > s.id ? 'bg-green-500/20' : 'bg-current/10',
                )}>
                  {step > s.id ? <Check className="w-3 h-3" /> : <s.icon className="w-3 h-3" />}
                </div>
                <span className="hidden sm:block font-medium">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('w-4 h-px flex-shrink-0', step > s.id ? 'bg-green-500/40' : 'bg-border/40')} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
            {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="w-[18px] h-[18px] text-primary" /> })()}
            <div>
              <h2 className="text-sm font-semibold text-foreground">{STEPS[step - 1].label}</h2>
              <p className="text-xs text-muted-foreground">{STEPS[step - 1].desc}</p>
            </div>
          </div>

          {step === 1 && (
            <Step1Lead selectedLead={selectedLead} onSelectLead={setSelectedLead} />
          )}
          {step === 2 && (
            <Step2Personalizar
              templateId={templateId}
              onTemplateId={setTemplateId}
              templates={templates}
              tituloPersonalizado={tituloPersonalizado}
              onTitulo={setTituloPersonalizado}
              assinatura={assinatura}
              onAssinatura={setAssinatura}
              validadeDias={validadeDias}
              onValidade={setValidadeDias}
              empresa={selectedLead?.empresa}
              responsavel={selectedLead?.responsavel}
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 1} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>

          {step < 2 ? (
            <Button
              onClick={handleNext}
              disabled={!canNext}
              className="gap-2 bg-primary hover:bg-primary/90 text-white"
            >
              Continuar
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={createApresentacao.isPending || !selectedLead}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <Presentation className="w-4 h-4" />
              {createApresentacao.isPending ? 'Gerando...' : 'Gerar Apresentação'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
