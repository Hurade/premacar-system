import { useState } from 'react'
import { Send, ArrowLeft, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useWikiRoleplays, useSimulatorStart, useSimulatorTurn, useSimulatorEvaluate } from '@/hooks/useWiki'
import { AREA_OPTIONS } from '@/types/wiki'
import type { WikiSimulatorTurn } from '@/types/wiki'

export function Simulador() {
  const [area, setArea] = useState<string | null>(null)
  const { data: roleplays } = useWikiRoleplays(area)
  const [roleplayId, setRoleplayId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<WikiSimulatorTurn[]>([])
  const [message, setMessage] = useState('')
  const [evaluation, setEvaluation] = useState<{ score: number; feedback: string; criteria_met: { criterion: string; met: boolean; note: string }[] } | null>(null)

  const start = useSimulatorStart()
  const turn = useSimulatorTurn()
  const evaluate = useSimulatorEvaluate()

  const selectedRoleplay = roleplays?.find((r) => r.id === roleplayId)

  async function handleStart(id: string) {
    setRoleplayId(id)
    setEvaluation(null)
    const res = await start.mutateAsync(id)
    setSessionId(res.session_id)
    setTranscript([{ role: 'customer', content: res.opening, at: new Date().toISOString() }])
  }

  async function handleSend() {
    if (!message.trim() || !sessionId) return
    const msg = message.trim()
    setMessage('')
    setTranscript((t) => [...t, { role: 'user', content: msg, at: new Date().toISOString() }])
    const res = await turn.mutateAsync({ sessionId, message: msg })
    setTranscript(res.transcript)
  }

  async function handleEvaluate() {
    if (!sessionId) return
    const res = await evaluate.mutateAsync(sessionId)
    setEvaluation(res)
  }

  function handleReset() {
    setRoleplayId(null); setSessionId(null); setTranscript([]); setEvaluation(null)
  }

  if (!roleplayId) {
    return (
      <div className="space-y-4">
        <Select value={area ?? 'all'} onValueChange={(v) => setArea(v === 'all' ? null : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar área" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as áreas</SelectItem>
            {AREA_OPTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="space-y-2">
          {(roleplays ?? []).map((rp) => (
            <button
              key={rp.id}
              onClick={() => handleStart(rp.id)}
              className="w-full text-left bg-card/60 border border-border/50 rounded-2xl p-4 hover:border-primary/40 transition-colors"
            >
              <p className="font-medium text-foreground">{rp.title}</p>
              <p className="text-sm text-muted-foreground line-clamp-2">{rp.context}</p>
            </button>
          ))}
          {(roleplays ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum cenário disponível.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <button onClick={handleReset} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Escolher outro cenário
      </button>

      {selectedRoleplay && (
        <div className="bg-muted/30 rounded-xl p-3 text-sm text-muted-foreground">
          <strong className="text-foreground">{selectedRoleplay.title}</strong> — {selectedRoleplay.objective}
        </div>
      )}

      {!evaluation ? (
        <>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transcript.map((t, i) => (
              <div key={i} className={cn('max-w-[85%] rounded-2xl px-4 py-2 text-sm', t.role === 'customer' ? 'bg-card/60 border border-border/50' : 'bg-primary/10 ml-auto')}>
                {t.content}
              </div>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Responda como atendente..."
              className="min-h-[44px] max-h-32"
              rows={1}
            />
            <Button onClick={handleSend} disabled={turn.isPending || !message.trim()} size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={handleEvaluate} disabled={evaluate.isPending || transcript.length < 2} className="w-full">
            Finalizar e avaliar
          </Button>
        </>
      ) : (
        <div className="bg-card/60 border border-border/50 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            <p className="text-2xl font-bold text-foreground">{evaluation.score}/100</p>
          </div>
          <p className="text-sm text-foreground">{evaluation.feedback}</p>
          <div className="space-y-1">
            {evaluation.criteria_met.map((c, i) => (
              <div key={i} className={cn('text-sm flex items-start gap-2', c.met ? 'text-green-500' : 'text-red-400')}>
                <span>{c.met ? '✓' : '✗'}</span>
                <span className="text-foreground">{c.criterion}{c.note && <span className="text-muted-foreground"> — {c.note}</span>}</span>
              </div>
            ))}
          </div>
          <Button onClick={handleReset} className="w-full">Tentar outro cenário</Button>
        </div>
      )}
    </div>
  )
}
