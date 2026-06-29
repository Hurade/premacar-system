import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Filter, TrendingUp, TrendingDown, FileText,
  Send, Eye, CheckCircle2, XCircle, Clock, DollarSign,
  PercentIcon, BookOpen, Users, SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { usePropostas, usePropostaMetrics } from '@/hooks/usePropostas'
import { PropostaCard } from '@/components/propostas/PropostaCard'
import { StatusBadge } from '@/components/propostas/StatusBadge'
import { formatarMoeda, STATUS_LABELS, type StatusProposta } from '@/types/propostas'
import { cn } from '@/lib/utils'

function MetricCard({
  label, value, sub, icon: Icon, trend, color = 'primary',
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  trend?: number
  color?: 'primary' | 'green' | 'red' | 'blue' | 'yellow' | 'violet'
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-400',
    red: 'bg-red-500/10 text-red-400',
    blue: 'bg-blue-500/10 text-blue-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    violet: 'bg-violet-500/10 text-violet-400',
  }

  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4 hover:border-primary/20 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', colorMap[color])}>
          <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
        </div>
        {trend !== undefined && (
          <span className={cn('text-xs font-medium flex items-center gap-0.5', trend >= 0 ? 'text-green-400' : 'text-red-400')}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  )
}

function FunnelBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-28 text-right truncate">{label}</span>
      <div className="flex-1 h-2 bg-muted/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold text-foreground w-5 text-right">{count}</span>
      <span className="text-xs text-muted-foreground w-8">({pct}%)</span>
    </div>
  )
}

const STATUS_OPTIONS: StatusProposta[] = [
  'rascunho', 'enviada', 'visualizada', 'em_negociacao', 'revisao', 'aceita', 'recusada', 'expirada',
]

export default function PropostasDashboard() {
  const navigate = useNavigate()
  const { data: propostas = [], isLoading } = usePropostas()
  const { data: metrics } = usePropostaMetrics()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const [planoFilter, setPlanoFilter] = useState<string>('todos')

  const filtered = propostas.filter(p => {
    const matchSearch = !search ||
      p.lead?.empresa.toLowerCase().includes(search.toLowerCase()) ||
      p.lead?.responsavel.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || p.status === statusFilter
    const matchPlano = planoFilter === 'todos' || p.plano?.tipo === planoFilter
    return matchSearch && matchStatus && matchPlano
  })

  const funnelSteps = [
    { label: 'Enviadas', count: metrics?.enviadas ?? 0, color: '#3b82f6' },
    { label: 'Visualizadas', count: metrics?.visualizadas ?? 0, color: '#eab308' },
    { label: 'Em Negociação', count: metrics?.em_negociacao ?? 0, color: '#8b5cf6' },
    { label: 'Aceitas', count: metrics?.aceitas ?? 0, color: '#22c55e' },
  ]
  const funnelTotal = metrics?.enviadas ?? 1

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Propostas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Geração e gestão de propostas comerciais
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/propostas/leads')} className="gap-2">
              <Users className="w-4 h-4" />
              Leads
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/propostas/biblioteca')} className="gap-2">
              <BookOpen className="w-4 h-4" />
              Biblioteca
            </Button>
            <Button
              onClick={() => navigate('/propostas/nova')}
              className="gap-2 bg-primary hover:bg-primary/90 text-white"
            >
              <Plus className="w-4 h-4" />
              Nova Proposta
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-muted/30 border border-border/40">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="propostas" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              Propostas
              {propostas.length > 0 && (
                <span className="ml-1.5 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">
                  {propostas.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="mt-6 space-y-6">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Total de Propostas" value={metrics?.total ?? 0} icon={FileText} color="primary" />
              <MetricCard label="Enviadas" value={metrics?.enviadas ?? 0} icon={Send} color="blue" />
              <MetricCard label="Visualizadas" value={metrics?.visualizadas ?? 0} icon={Eye} color="yellow" />
              <MetricCard label="Em Negociação" value={metrics?.em_negociacao ?? 0} icon={SlidersHorizontal} color="violet" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Aceitas" value={metrics?.aceitas ?? 0} icon={CheckCircle2} color="green" />
              <MetricCard label="Recusadas" value={metrics?.recusadas ?? 0} icon={XCircle} color="red" />
              <MetricCard label="Expiradas" value={metrics?.expiradas ?? 0} icon={Clock} color="primary" />
              <MetricCard
                label="Taxa de Conversão"
                value={`${metrics?.taxa_conversao ?? 0}%`}
                icon={PercentIcon}
                color={metrics && metrics.taxa_conversao >= 20 ? 'green' : 'yellow'}
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MetricCard
                label="Valor em Negociação"
                value={formatarMoeda(metrics?.valor_total_negociacao ?? 0)}
                sub="Soma de propostas ativas"
                icon={DollarSign}
                color="violet"
              />
              <MetricCard
                label="Receita Mensal Prevista"
                value={formatarMoeda(metrics?.receita_mensal_prevista ?? 0)}
                sub="Propostas aceitas"
                icon={TrendingUp}
                color="green"
              />
            </div>

            {/* Funnel */}
            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Funil de Propostas</h2>
              <div className="space-y-3">
                {funnelSteps.map(step => (
                  <FunnelBar key={step.label} {...step} total={funnelTotal} />
                ))}
              </div>
              {metrics && metrics.total > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Rascunhos</p>
                    <p className="font-bold text-foreground">{metrics.rascunho}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Recusadas</p>
                    <p className="font-bold text-red-400">{metrics.recusadas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expiradas</p>
                    <p className="font-bold text-muted-foreground">{metrics.expiradas}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Recent */}
            {propostas.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">Recentes</h2>
                  <button
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                    onClick={() => document.querySelector('[data-value="propostas"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
                  >
                    Ver todas →
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {propostas.slice(0, 6).map(p => (
                    <PropostaCard key={p.id} proposta={p} />
                  ))}
                </div>
              </div>
            )}

            {propostas.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-7 h-7 text-primary" />
                </div>
                <p className="text-foreground font-semibold">Nenhuma proposta ainda</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Crie sua primeira proposta e comece a acompanhar o funil
                </p>
                <Button onClick={() => navigate('/propostas/nova')} className="mt-4 bg-primary hover:bg-primary/90 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira proposta
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Propostas list Tab */}
          <TabsContent value="propostas" className="mt-6 space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por empresa ou responsável..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-muted/20 border-border/40"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48 bg-muted/20 border-border/40">
                  <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os status</SelectItem>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s} value={s}>
                      <StatusBadge status={s} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={planoFilter} onValueChange={setPlanoFilter}>
                <SelectTrigger className="w-full sm:w-40 bg-muted/20 border-border/40">
                  <SelectValue placeholder="Plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os planos</SelectItem>
                  <SelectItem value="mensurar">Mensurar — R$299</SelectItem>
                  <SelectItem value="fidelizar">Fidelizar — R$497</SelectItem>
                  <SelectItem value="recuperar">Recuperar — R$997</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map(p => <PropostaCard key={p.id} proposta={p} />)}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">
                  {propostas.length === 0 ? 'Nenhuma proposta criada ainda.' : 'Nenhuma proposta encontrada com esses filtros.'}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
