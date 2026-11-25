import { useState } from 'react'
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWikiModules, useWikiProgress } from '@/hooks/useWiki'
import { TRACK_OPTIONS } from '@/types/wiki'
import { ModuloDetalhe } from './ModuloDetalhe'
import { TrilhaFinalQuiz } from './TrilhaFinalQuiz'

export function Trilhas() {
  const [track, setTrack] = useState<string>(TRACK_OPTIONS[0])
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const { data: modules } = useWikiModules(track)
  const { data: progress } = useWikiProgress()

  const progressByModule = new Map((progress ?? []).map((p) => [p.module_id, p]))
  const allStudied = (modules ?? []).length > 0 && (modules ?? []).every((m) => progressByModule.get(m.id)?.studied_at)

  if (selectedModuleId) {
    return (
      <ModuloDetalhe
        moduleId={selectedModuleId}
        onBack={() => setSelectedModuleId(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TRACK_OPTIONS.map((t) => (
          <button
            key={t}
            onClick={() => setTrack(t)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-sm font-medium border transition-colors',
              track === t ? 'bg-primary text-primary-foreground border-primary' : 'border-border/50 text-muted-foreground hover:text-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {(modules ?? []).map((m) => {
          const p = progressByModule.get(m.id)
          return (
            <button
              key={m.id}
              onClick={() => setSelectedModuleId(m.id)}
              className="w-full flex items-center gap-3 bg-card/60 border border-border/50 rounded-2xl p-4 text-left hover:border-primary/40 transition-colors"
            >
              {p?.studied_at ? (
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
              ) : (
                <Circle className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">{m.title}</p>
                {m.summary && <p className="text-sm text-muted-foreground line-clamp-1">{m.summary}</p>}
                {p?.quiz_total != null && (
                  <p className="text-xs text-muted-foreground mt-0.5">Quiz: {p.quiz_score}/{p.quiz_total}</p>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            </button>
          )
        })}
        {(modules ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum módulo nesta trilha ainda.</p>
        )}
      </div>

      {allStudied && <TrilhaFinalQuiz track={track} />}
    </div>
  )
}
