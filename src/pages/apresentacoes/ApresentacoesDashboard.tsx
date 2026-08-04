import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Filter, Presentation, Send, Eye, Clock, Users, PercentIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useApresentacoes, useApresentacaoMetrics } from '@/hooks/useApresentacoes'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { ApresentacaoCard } from '@/components/apresentacoes/ApresentacaoCard'
import { StatusBadge } from '@/components/apresentacoes/StatusBadge'
import type { StatusApresentacao } from '@/types/apresentacoes'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

function MetricCard({
  label, value, sub, icon: Icon, color = 'primary',
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color?: 'primary' | 'green' | 'blue' | 'yellow'
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    green: 'bg-green-500/10 text-green-400',
    blue: 'bg-blue-500/10 text-blue-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
  }

  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4 hover:border-primary/20 transition-all">
      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', colorMap[color])}>
        <Icon className="w-[18px] h-[18px]" />
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

const STATUS_OPTIONS: StatusApresentacao[] = ['rascunho', 'enviada', 'visualizada', 'expirada']

export default function ApresentacoesDashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: apresentacoes = [], isLoading } = useApresentacoes()
  const { data: metrics } = useApresentacaoMetrics()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('todos')

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const channel = (supabase as any)
      .channel('apresentacoes_status_alerts')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'apresentacoes_comerciais' },
        (payload: { new: { status: string; id: string }; old: { status: string } }) => {
          const { new: updated, old: previous } = payload
          if (updated.status === previous.status) return

          if (updated.status === 'visualizada') {
            toast.success('Apresentação visualizada!', {
              description: 'Um lead acabou de abrir uma apresentação.',
              action: { label: 'Ver', onClick: () => navigate(`/apresentacoes/${updated.id}`) },
              duration: 8000,
            })
            queryClient.invalidateQueries({ queryKey: ['apresentacoes_comerciais'] })
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [navigate, queryClient])

  const filtered = apresentacoes.filter(a => {
    const matchSearch = !search ||
      a.lead?.empresa.toLowerCase().includes(search.toLowerCase()) ||
      a.lead?.responsavel.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'todos' || a.status === statusFilter
    return matchSearch && matchStatus
  })

  const funnelSteps = [
    { label: 'Enviadas', count: metrics?.enviadas ?? 0, color: '#3b82f6' },
    { label: 'Visualizadas', count: metrics?.visualizadas ?? 0, color: '#22c55e' },
  ]
  const funnelTotal = metrics?.enviadas ?? 1

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Apresentações</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Geração e gestão de apresentações institucionais
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/propostas/leads')} className="gap-2">
              <Users className="w-4 h-4" />
              Leads
            </Button>
            <Button
              onClick={() => navigate('/apresentacoes/nova')}
              className="gap-2 bg-primary hover:bg-primary/90 text-white"
            >
              <Plus className="w-4 h-4" />
              Nova Apresentação
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard">
          <TabsList className="bg-muted/30 border border-border/40">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="lista" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              Apresentações
              {apresentacoes.length > 0 && (
                <span className="ml-1.5 bg-primary/20 text-primary text-xs px-1.5 py-0.5 rounded-full">
                  {apresentacoes.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6 space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Total de Apresentações" value={metrics?.total ?? 0} icon={Presentation} color="primary" />
              <MetricCard label="Enviadas" value={metrics?.enviadas ?? 0} icon={Send} color="blue" />
              <MetricCard label="Visualizadas" value={metrics?.visualizadas ?? 0} icon={Eye} color="green" />
              <MetricCard
                label="Taxa de Visualização"
                value={`${metrics?.taxa_visualizacao ?? 0}%`}
                icon={PercentIcon}
                color={metrics && metrics.taxa_visualizacao >= 40 ? 'green' : 'yellow'}
              />
            </div>

            <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-foreground mb-4">Funil de Apresentações</h2>
              <div className="space-y-3">
                {funnelSteps.map(step => (
                  <FunnelBar key={step.label} {...step} total={funnelTotal} />
                ))}
              </div>
              {metrics && metrics.total > 0 && (
                <div className="mt-4 pt-4 border-t border-border/40 grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Rascunhos</p>
                    <p className="font-bold text-foreground">{metrics.rascunho}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expiradas</p>
                    <p className="font-bold text-muted-foreground">{metrics.expiradas}</p>
                  </div>
                </div>
              )}
            </div>

            {apresentacoes.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">Recentes</h2>
                  <button
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                    onClick={() => document.querySelector('[data-value="lista"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))}
                  >
                    Ver todas →
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {apresentacoes.slice(0, 6).map(a => (
                    <ApresentacaoCard key={a.id} apresentacao={a} />
                  ))}
                </div>
              </div>
            )}

            {apresentacoes.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Presentation className="w-7 h-7 text-primary" />
                </div>
                <p className="text-foreground font-semibold">Nenhuma apresentação ainda</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Gere sua primeira apresentação e comece a acompanhar as visualizações
                </p>
                <Button onClick={() => navigate('/apresentacoes/nova')} className="mt-4 bg-primary hover:bg-primary/90 text-white">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar primeira apresentação
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="lista" className="mt-6 space-y-4">
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
            </div>

            {filtered.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map(a => <ApresentacaoCard key={a.id} apresentacao={a} />)}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground text-sm">
                  {apresentacoes.length === 0 ? 'Nenhuma apresentação criada ainda.' : 'Nenhuma apresentação encontrada com esses filtros.'}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
