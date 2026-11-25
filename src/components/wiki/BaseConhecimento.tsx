import { useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useWikiSearch } from '@/hooks/useWiki'
import { AREA_OPTIONS, SYSTEM_OPTIONS } from '@/types/wiki'
import { ArticleCard } from './ArticleCard'

export function BaseConhecimento() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [area, setArea] = useState<string | null>(null)
  const [system, setSystem] = useState<string | null>(null)

  // debounce simples sem lib extra
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  function handleQueryChange(v: string) {
    setQuery(v)
    if (timer) clearTimeout(timer)
    setTimer(setTimeout(() => setDebouncedQuery(v), 350))
  }

  const { data: results, isLoading } = useWikiSearch(debouncedQuery, area, system)

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar artigos, procedimentos, termos..."
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={area ?? 'all'} onValueChange={(v) => setArea(v === 'all' ? null : v)}>
          <SelectTrigger className="sm:w-44"><SelectValue placeholder="Área" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {AREA_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={system ?? 'all'} onValueChange={(v) => setSystem(v === 'all' ? null : v)}>
          <SelectTrigger className="sm:w-48"><SelectValue placeholder="Sistema" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os sistemas</SelectItem>
            {SYSTEM_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
      {!isLoading && results?.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum artigo encontrado.</p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results?.map((r) => <ArticleCard key={r.id} article={r} />)}
      </div>
    </div>
  )
}
