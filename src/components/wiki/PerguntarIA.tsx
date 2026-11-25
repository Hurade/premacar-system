import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useWikiAsk, useWikiFeedback } from '@/hooks/useWiki'
import { AREA_OPTIONS, type WikiAgent, type WikiAskResponse } from '@/types/wiki'

const AGENTS: { id: WikiAgent; nome: string; descricao: string }[] = [
  { id: 'max', nome: 'Max', descricao: 'Suporte' },
  { id: 'clara', nome: 'Clara', descricao: 'CS' },
  { id: 'tutor', nome: 'Tutor', descricao: 'Todas as áreas' },
]

interface ThreadItem {
  question: string
  response?: WikiAskResponse
  loading?: boolean
}

export function PerguntarIA() {
  const [agent, setAgent] = useState<WikiAgent>('tutor')
  const [area, setArea] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [thread, setThread] = useState<ThreadItem[]>([])
  const ask = useWikiAsk()
  const feedback = useWikiFeedback()
  const navigate = useNavigate()

  async function handleAsk() {
    if (!question.trim()) return
    const q = question.trim()
    setQuestion('')
    setThread((t) => [...t, { question: q, loading: true }])
    try {
      const response = await ask.mutateAsync({ agent, area: agent === 'tutor' ? area : undefined, question: q })
      setThread((t) => t.map((item, i) => i === t.length - 1 ? { question: q, response } : item))
    } catch {
      setThread((t) => t.slice(0, -1))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {AGENTS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAgent(a.id)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors',
              agent === a.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'
            )}
          >
            {a.nome} <span className="opacity-70">· {a.descricao}</span>
          </button>
        ))}
        {agent === 'tutor' && (
          <Select value={area ?? 'all'} onValueChange={(v) => setArea(v === 'all' ? null : v)}>
            <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Filtrar área" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as áreas</SelectItem>
              {AREA_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-4 min-h-[200px]">
        {thread.length === 0 && (
          <p className="text-sm text-muted-foreground">Pergunte algo sobre processos, produtos ou procedimentos — a resposta vem só da base de conhecimento.</p>
        )}
        {thread.map((item, i) => (
          <div key={i} className="space-y-2">
            <div className="bg-primary/10 rounded-2xl rounded-tr-sm px-4 py-2 ml-auto max-w-[85%] text-sm text-foreground">
              {item.question}
            </div>
            {item.loading && <p className="text-sm text-muted-foreground">Pensando...</p>}
            {item.response && (
              <div className="bg-card/60 border border-border/50 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] space-y-2">
                <p className="text-sm text-foreground whitespace-pre-wrap">{item.response.answer}</p>
                {item.response.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border/40">
                    {item.response.sources.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => navigate(`/wiki/artigo/${s.id}`)}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:text-foreground"
                      >
                        {s.title}
                      </button>
                    ))}
                  </div>
                )}
                {item.response.is_gap && (
                  <p className="text-xs text-amber-500">Não encontrei isso na base — considerado uma lacuna.</p>
                )}
                {item.response.query_id && (
                  <button
                    onClick={() => feedback.mutate({ aiQueryId: item.response!.query_id!, rating: -1 })}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <ThumbsDown className="w-3 h-3" /> Não ajudou
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 items-end">
        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() } }}
          placeholder="Digite sua pergunta..."
          className="min-h-[44px] max-h-32"
          rows={1}
        />
        <Button onClick={handleAsk} disabled={ask.isPending || !question.trim()} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
