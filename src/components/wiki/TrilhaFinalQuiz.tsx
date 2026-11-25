import { useState } from 'react'
import { Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWikiTrackQuiz, useSubmitTrackQuiz } from '@/hooks/useWiki'
import { QuizModal } from './QuizModal'

export function TrilhaFinalQuiz({ track }: { track: string }) {
  const { data: questions } = useWikiTrackQuiz(track)
  const submitTrackQuiz = useSubmitTrackQuiz()
  const [open, setOpen] = useState(false)

  if (!questions || questions.length === 0) return null

  return (
    <div className="bg-primary/5 border border-primary/30 rounded-2xl p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <Award className="w-6 h-6 text-primary flex-shrink-0" />
        <div>
          <p className="font-medium text-foreground">Todos os módulos estudados!</p>
          <p className="text-sm text-muted-foreground">Faça o quiz final da trilha {track}.</p>
        </div>
      </div>
      <Button onClick={() => setOpen(true)}>Fazer quiz final</Button>
      <QuizModal
        open={open}
        onClose={() => setOpen(false)}
        title={`Quiz final — ${track}`}
        questions={questions}
        onFinish={(score, total) => submitTrackQuiz.mutate({ track, score, total })}
      />
    </div>
  )
}
