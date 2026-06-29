import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ArrowLeft, ArrowRight, Check, Building2, ClipboardList,
  Sparkles, FileText, Plus, Search, Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCRMContacts, useLeadFromContact, useCreateLead, type CRMContact } from '@/hooks/useLeads'
import { useCreateProposta, usePlanos } from '@/hooks/usePropostas'
import type { Lead, DiagnosticoRespostas, PlanoTipo, TipoNegocio, OrigemLead, DorPrincipal, ExtraItem } from '@/types/propostas'
import {
  PLANOS_PADRAO, TIPO_NEGOCIO_LABELS, ORIGEM_LABELS, DOR_LABELS,
  recomendarPlano, formatarMoeda, descFidelidadePct, calcularTotal,
} from '@/types/propostas'
import { cn } from '@/lib/utils'

const STEPS = [
  { id: 1, label: 'Lead', icon: Building2, desc: 'Selecione ou cadastre o lead' },
  { id: 2, label: 'Diagnóstico', icon: ClipboardList, desc: 'Perguntas sobre a operação' },
  { id: 3, label: 'Plano', icon: Sparkles, desc: 'Plano recomendado' },
  { id: 4, label: 'Proposta', icon: FileText, desc: 'Revise e gere a proposta' },
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

const diagDefaults: DiagnosticoRespostas = {
  faz_pos_venda: false,
  como_lembra_revisao: 'nada',
  mede_nps: false,
  base_parada: true,
  whatsapp_tipo: 'manual',
  quer_recuperar: true,
  tem_equipe_followup: false,
  objetivo_principal: 'fidelizar',
}

// ─── Step 1: Select Lead ─────────────────────────────────────────────────────
function Step1Lead({
  selectedLead, onSelectLead,
}: { selectedLead: Lead | null; onSelectLead: (l: Lead) => void }) {
  const location = useLocation()
  const preselectedId = (location.state as { leadId?: string })?.leadId
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
      // Auto-select if pre-selected from Leads page
      if (preselectedId && lead.id === preselectedId) {
        onSelectLead(lead)
        return
      }
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
          <div className="col-span-2 space-y-1">
            <Label>Clientes/mês</Label>
            <div className="flex gap-2">
              <Input {...F('clientes_mes')} type="number" placeholder="Ex: 400" className="bg-muted/20 border-border/40 flex-1" />
              <Input {...F('clientes_base')} type="number" placeholder="Base total" className="bg-muted/20 border-border/40 flex-1" />
            </div>
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
          const isLoading = loadingContactId === contact.id
          return (
            <button
              key={contact.id}
              onClick={() => handleSelectContact(contact)}
              disabled={isLoading || leadFromContact.isPending}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all disabled:opacity-60',
                'border-border/40 hover:border-primary/30 hover:bg-muted/20',
              )}
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
              {isLoading && <div className="w-4 h-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin flex-shrink-0" />}
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

// ─── Step 2: Diagnóstico ─────────────────────────────────────────────────────
function YesNoButton({ value, current, onChange, label }: { value: boolean; current: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(value)}
      className={cn(
        'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all',
        current === value
          ? 'bg-primary/15 border-primary text-primary'
          : 'border-border/40 text-muted-foreground hover:border-primary/30',
      )}
    >
      {label}
    </button>
  )
}

function Step2Diagnostico({ diagnostico, onChange }: {
  diagnostico: DiagnosticoRespostas
  onChange: (d: DiagnosticoRespostas) => void
}) {
  const set = <K extends keyof DiagnosticoRespostas>(key: K, val: DiagnosticoRespostas[K]) =>
    onChange({ ...diagnostico, [key]: val })

  const questions = [
    {
      label: 'Hoje vocês fazem pós-venda ativo com os clientes?',
      node: (
        <div className="flex gap-2">
          <YesNoButton value={true} current={diagnostico.faz_pos_venda} onChange={v => set('faz_pos_venda', v)} label="Sim" />
          <YesNoButton value={false} current={diagnostico.faz_pos_venda} onChange={v => set('faz_pos_venda', v)} label="Não" />
        </div>
      ),
    },
    {
      label: 'Como lembram o cliente da próxima revisão?',
      node: (
        <Select value={diagnostico.como_lembra_revisao} onValueChange={v => set('como_lembra_revisao', v)}>
          <SelectTrigger className="bg-muted/20 border-border/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nada">Não fazemos isso</SelectItem>
            <SelectItem value="ligacao">Ligação manual</SelectItem>
            <SelectItem value="whatsapp_manual">WhatsApp manual</SelectItem>
            <SelectItem value="sistema">Sistema automatizado</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      label: 'Medem satisfação dos clientes (NPS ou pesquisa)?',
      node: (
        <div className="flex gap-2">
          <YesNoButton value={true} current={diagnostico.mede_nps} onChange={v => set('mede_nps', v)} label="Sim" />
          <YesNoButton value={false} current={diagnostico.mede_nps} onChange={v => set('mede_nps', v)} label="Não" />
        </div>
      ),
    },
    {
      label: 'Têm base de clientes parada (inativos há +90 dias)?',
      node: (
        <div className="flex gap-2">
          <YesNoButton value={true} current={diagnostico.base_parada} onChange={v => set('base_parada', v)} label="Sim" />
          <YesNoButton value={false} current={diagnostico.base_parada} onChange={v => set('base_parada', v)} label="Não" />
        </div>
      ),
    },
    {
      label: 'Como usam o WhatsApp para atendimento?',
      node: (
        <Select value={diagnostico.whatsapp_tipo} onValueChange={v => set('whatsapp_tipo', v as DiagnosticoRespostas['whatsapp_tipo'])}>
          <SelectTrigger className="bg-muted/20 border-border/40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="nenhum">Não usamos</SelectItem>
            <SelectItem value="manual">Manual (cada um envia no celular)</SelectItem>
            <SelectItem value="automatizado">Automatizado</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      label: 'Querem recuperar clientes que pararam de vir?',
      node: (
        <div className="flex gap-2">
          <YesNoButton value={true} current={diagnostico.quer_recuperar} onChange={v => set('quer_recuperar', v)} label="Sim" />
          <YesNoButton value={false} current={diagnostico.quer_recuperar} onChange={v => set('quer_recuperar', v)} label="Não" />
        </div>
      ),
    },
    {
      label: 'Têm equipe disponível para fazer follow-up manualmente?',
      node: (
        <div className="flex gap-2">
          <YesNoButton value={true} current={diagnostico.tem_equipe_followup} onChange={v => set('tem_equipe_followup', v)} label="Sim" />
          <YesNoButton value={false} current={diagnostico.tem_equipe_followup} onChange={v => set('tem_equipe_followup', v)} label="Não" />
        </div>
      ),
    },
    {
      label: 'Qual é o objetivo principal agora?',
      node: (
        <div className="grid grid-cols-3 gap-2">
          {([
            ['satisfacao', 'Medir Satisfação'],
            ['fidelizar', 'Fidelizar Clientes'],
            ['recuperar', 'Recuperar Inativos'],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => set('objetivo_principal', val)}
              className={cn(
                'py-2.5 rounded-xl text-xs font-medium border transition-all',
                diagnostico.objetivo_principal === val
                  ? 'bg-primary/15 border-primary text-primary'
                  : 'border-border/40 text-muted-foreground hover:border-primary/30',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-5">
      {questions.map((q, i) => (
        <div key={i} className="space-y-2">
          <p className="text-sm font-medium text-foreground">
            <span className="text-primary mr-1.5">{i + 1}.</span>{q.label}
          </p>
          {q.node}
        </div>
      ))}
    </div>
  )
}

const EXTRAS_SUGERIDOS = ['Rastreamento', 'Telefone Digital', 'Setup', 'Treinamento', 'Outro']

// ─── Step 3: Plano ────────────────────────────────────────────────────────────
function Step3Plano({
  planoSelecionado, desconto, condicaoEspecial, validadeDias,
  fidelidade, unidades, extras,
  onPlano, onDesconto, onCondicao, onValidade, onFidelidade, onUnidades, onExtras,
  recomendado,
}: {
  planoSelecionado: PlanoTipo
  recomendado: PlanoTipo
  desconto: number
  condicaoEspecial: string
  validadeDias: number
  fidelidade: number
  unidades: number
  extras: ExtraItem[]
  onPlano: (p: PlanoTipo) => void
  onDesconto: (d: number) => void
  onCondicao: (c: string) => void
  onValidade: (v: number) => void
  onFidelidade: (f: number) => void
  onUnidades: (u: number) => void
  onExtras: (e: ExtraItem[]) => void
}) {
  const planoPrecisa = planoSelecionado === 'fidelizar' || planoSelecionado === 'recuperar'

  function addExtra() {
    onExtras([...extras, { nome: '', valor: 0 }])
  }
  function updateExtra(i: number, field: keyof ExtraItem, value: string | number) {
    onExtras(extras.map((e, idx) => idx === i ? { ...e, [field]: value } : e))
  }
  function removeExtra(i: number) {
    onExtras(extras.filter((_, idx) => idx !== i))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
        <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
        <span className="text-foreground">
          Com base no diagnóstico, recomendamos o{' '}
          <strong className="text-primary">{PLANOS_PADRAO[recomendado].nome}</strong>.
        </span>
      </div>

      {/* Planos */}
      <div className="grid grid-cols-1 gap-3">
        {(Object.keys(PLANOS_PADRAO) as PlanoTipo[]).map(tipo => {
          const plano = PLANOS_PADRAO[tipo]
          const isSelected = planoSelecionado === tipo
          const isRec = recomendado === tipo
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => onPlano(tipo)}
              className={cn(
                'text-left p-4 rounded-2xl border transition-all',
                isSelected ? 'border-primary bg-primary/10' : 'border-border/40 hover:border-primary/30',
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-foreground text-sm">{plano.nome}</p>
                  {isRec && (
                    <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full font-semibold">Recomendado</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-foreground">{formatarMoeda(plano.preco)}</p>
                  <span className="text-xs text-muted-foreground">/mês</span>
                  {isSelected && <Check className="w-4 h-4 text-primary" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2">{plano.descricao}</p>
              <div className="flex flex-wrap gap-1">
                {plano.recursos.slice(0, 3).map(r => (
                  <span key={r} className="text-[10px] bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded">{r}</span>
                ))}
                {plano.recursos.length > 3 && (
                  <span className="text-[10px] text-muted-foreground px-1 py-0.5">+{plano.recursos.length - 3} mais</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Fidelidade — apenas Fidelizar e Recuperar */}
      {planoPrecisa && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <Label>Fidelidade de contrato</Label>
          <p className="text-xs text-muted-foreground">Desconto progressivo para contratos com fidelidade</p>
          <div className="grid grid-cols-4 gap-2">
            {([0, 3, 6, 12] as const).map(m => {
              const pct = descFidelidadePct(m, planoSelecionado)
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onFidelidade(m)}
                  className={cn(
                    'p-2.5 rounded-xl border text-center transition-all text-sm font-medium',
                    fidelidade === m
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border/40 text-muted-foreground hover:border-primary/30',
                  )}
                >
                  {m === 0 ? 'Sem' : `${m} m.`}
                  {pct > 0 && (
                    <span className="block text-[10px] font-semibold text-green-400">-{pct}%</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Unidades + Desconto + Validade */}
      <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/40">
        <div className="space-y-1.5">
          <Label>Unidades / Lojas</Label>
          <Input
            type="number"
            min={1}
            value={unidades}
            onChange={e => onUnidades(Math.max(1, Number(e.target.value)))}
            className="bg-muted/20 border-border/40"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Desconto extra (%)</Label>
          <Input
            type="number"
            min={0}
            max={50}
            value={desconto}
            onChange={e => onDesconto(Number(e.target.value))}
            className="bg-muted/20 border-border/40"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Validade (dias)</Label>
          <Input
            type="number"
            min={1}
            max={90}
            value={validadeDias}
            onChange={e => onValidade(Number(e.target.value))}
            className="bg-muted/20 border-border/40"
          />
        </div>
        <div className="col-span-3 space-y-1.5">
          <Label>Condição Especial</Label>
          <Input
            value={condicaoEspecial}
            onChange={e => onCondicao(e.target.value)}
            placeholder="Ex: 1º mês grátis, setup incluso..."
            className="bg-muted/20 border-border/40"
          />
        </div>
      </div>

      {/* Custos extras */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <Label>Custos adicionais</Label>
          <button type="button" onClick={addExtra} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
            <Plus className="w-3.5 h-3.5" />
            Adicionar item
          </button>
        </div>
        {extras.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum custo adicional. Ex: Rastreamento, Telefone Digital...</p>
        )}
        <div className="space-y-2">
          {extras.map((extra, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select
                value={EXTRAS_SUGERIDOS.includes(extra.nome) ? extra.nome : (extra.nome ? 'Outro' : '')}
                onValueChange={v => updateExtra(i, 'nome', v === 'Outro' ? '' : v)}
              >
                <SelectTrigger className="bg-muted/20 border-border/40 flex-1 h-8 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  {EXTRAS_SUGERIDOS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                placeholder="Nome do item"
                value={extra.nome}
                onChange={e => updateExtra(i, 'nome', e.target.value)}
                className="bg-muted/20 border-border/40 flex-1 h-8 text-xs"
              />
              <Input
                type="number"
                min={0}
                placeholder="R$ valor"
                value={extra.valor || ''}
                onChange={e => updateExtra(i, 'valor', Number(e.target.value))}
                className="bg-muted/20 border-border/40 w-28 h-8 text-xs"
              />
              <button type="button" aria-label="Remover item" onClick={() => removeExtra(i)} className="text-muted-foreground hover:text-red-400 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Preview ──────────────────────────────────────────────────────────
function Step4Preview({ lead, plano, desconto, condicao, validade, notas, onNotas, fidelidade, unidades, extras }: {
  lead: Lead
  plano: PlanoTipo
  desconto: number
  condicao: string
  validade: number
  notas: string
  fidelidade: number
  unidades: number
  extras: ExtraItem[]
  onNotas: (n: string) => void
}) {
  const info = PLANOS_PADRAO[plano]
  const validadeDate = new Date()
  validadeDate.setDate(validadeDate.getDate() + validade)

  const valorBase = info.preco * unidades
  const pctFid = descFidelidadePct(fidelidade, plano)
  const aposF = valorBase * (1 - pctFid / 100)
  const aposD = aposF * (1 - desconto / 100)
  const totalExtras = extras.reduce((a, e) => a + e.valor, 0)
  const total = aposD + totalExtras

  return (
    <div className="space-y-4">
      <div className="bg-muted/20 border border-border/40 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-border/40">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{lead.empresa}</p>
            <p className="text-xs text-muted-foreground">{lead.responsavel} — {lead.telefone}</p>
          </div>
        </div>

        {/* Breakdown de preço */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Composição do Valor</p>

          <div className="flex justify-between items-center text-sm">
            <span className="text-foreground flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: info.cor }}>{info.nome}</span>
              {unidades > 1 && <span className="text-muted-foreground text-xs">× {unidades} unidades</span>}
            </span>
            <span className="font-medium text-foreground">{formatarMoeda(valorBase)}/mês</span>
          </div>

          {pctFid > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-400">Desconto fidelidade {fidelidade} meses (-{pctFid}%)</span>
              <span className="text-green-400">-{formatarMoeda(valorBase * pctFid / 100)}/mês</span>
            </div>
          )}
          {desconto > 0 && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-green-400">Desconto adicional (-{desconto}%)</span>
              <span className="text-green-400">-{formatarMoeda(aposF * desconto / 100)}/mês</span>
            </div>
          )}
          {extras.map((e, i) => e.nome && (
            <div key={i} className="flex justify-between items-center text-sm">
              <span className="text-foreground">{e.nome}</span>
              <span className="text-foreground">{formatarMoeda(e.valor)}/mês</span>
            </div>
          ))}

          <div className="flex justify-between items-center pt-2 border-t border-border/50">
            <span className="font-semibold text-foreground">Total mensal</span>
            <span className="text-xl font-bold text-primary">{formatarMoeda(total)}/mês</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
          <div>
            <p className="text-xs text-muted-foreground">Validade da proposta</p>
            <p className="text-sm font-medium text-foreground">{validade} dias — até {validadeDate.toLocaleDateString('pt-BR')}</p>
          </div>
          {condicao && (
            <div>
              <p className="text-xs text-muted-foreground">Condição especial</p>
              <p className="text-sm font-medium text-green-400">{condicao}</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notas internas (não aparecem na proposta)</Label>
        <Textarea
          value={notas}
          onChange={e => onNotas(e.target.value)}
          placeholder="Observações da negociação, contexto do call, próximos passos..."
          rows={3}
          className="bg-muted/20 border-border/40 resize-none"
        />
      </div>
    </div>
  )
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
export default function NovaPropostaWizard() {
  const navigate = useNavigate()
  const createProposta = useCreateProposta()
  const { data: planos = [] } = usePlanos()

  const [step, setStep] = useState(1)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [diagnostico, setDiagnostico] = useState<DiagnosticoRespostas>(diagDefaults)
  const [planoSelecionado, setPlanoSelecionado] = useState<PlanoTipo>('fidelizar')
  const [desconto, setDesconto] = useState(0)
  const [condicaoEspecial, setCondicaoEspecial] = useState('')
  const [validadeDias, setValidadeDias] = useState(15)
  const [notas, setNotas] = useState('')
  const [fidelidade, setFidelidade] = useState(0)
  const [unidades, setUnidades] = useState(1)
  const [extras, setExtras] = useState<ExtraItem[]>([])

  const recomendado = recomendarPlano(diagnostico)

  function handleNext() {
    if (step === 2) setPlanoSelecionado(recomendado)
    setStep(s => Math.min(s + 1, 4))
  }

  function handleBack() {
    setStep(s => Math.max(s - 1, 1))
  }

  async function handleCreate() {
    if (!selectedLead) return
    const planoObj = planos.find((p: { tipo: string }) => p.tipo === planoSelecionado)
    const preco = planoObj?.preco_mensal ?? PLANOS_PADRAO[planoSelecionado].preco

    const proposta = await createProposta.mutateAsync({
      lead_id: selectedLead.id,
      empresa: selectedLead.empresa,
      plano_id: planoObj?.id ?? null,
      diagnostico,
      valor_mensal: preco,
      desconto_percentual: desconto,
      condicao_especial: condicaoEspecial || null,
      validade_dias: validadeDias,
      notas_vendedor: notas || null,
      unidades,
      fidelidade_meses: fidelidade,
      extras: extras.length > 0 ? extras : null,
    })

    navigate(`/propostas/${proposta.id}`)
  }

  const canNext = step === 1 ? !!selectedLead : true

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Voltar" onClick={() => navigate('/propostas')} className="p-2 rounded-xl hover:bg-muted/50">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Nova Proposta</h1>
            <p className="text-xs text-muted-foreground">Passo {step} de 4</p>
          </div>
        </div>

        {/* Steps indicator */}
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

        {/* Step title */}
        <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/40">
            {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="w-4.5 w-[18px] h-[18px] text-primary" /> })()}
            <div>
              <h2 className="text-sm font-semibold text-foreground">{STEPS[step - 1].label}</h2>
              <p className="text-xs text-muted-foreground">{STEPS[step - 1].desc}</p>
            </div>
          </div>

          {step === 1 && (
            <Step1Lead selectedLead={selectedLead} onSelectLead={setSelectedLead} />
          )}
          {step === 2 && (
            <Step2Diagnostico diagnostico={diagnostico} onChange={setDiagnostico} />
          )}
          {step === 3 && (
            <Step3Plano
              planoSelecionado={planoSelecionado}
              recomendado={recomendado}
              desconto={desconto}
              condicaoEspecial={condicaoEspecial}
              validadeDias={validadeDias}
              fidelidade={fidelidade}
              unidades={unidades}
              extras={extras}
              onPlano={setPlanoSelecionado}
              onDesconto={setDesconto}
              onCondicao={setCondicaoEspecial}
              onValidade={setValidadeDias}
              onFidelidade={setFidelidade}
              onUnidades={setUnidades}
              onExtras={setExtras}
            />
          )}
          {step === 4 && selectedLead && (
            <Step4Preview
              lead={selectedLead}
              plano={planoSelecionado}
              desconto={desconto}
              condicao={condicaoEspecial}
              validade={validadeDias}
              notas={notas}
              fidelidade={fidelidade}
              unidades={unidades}
              extras={extras}
              onNotas={setNotas}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBack} disabled={step === 1} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>

          {step < 4 ? (
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
              disabled={createProposta.isPending || !selectedLead}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              <FileText className="w-4 h-4" />
              {createProposta.isPending ? 'Gerando...' : 'Gerar Proposta'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
