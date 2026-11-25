import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { WikiQuizQuestion } from '@/types/wiki'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  questions: WikiQuizQuestion[]
  onFinish: (score: number, total: number) => void
}

export function QuizModal({ open, onClose, title, questions, onFinish }: Props) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [score, setScore] = useState(0)
  const [finished, setFinished] = useState(false)

  const question = questions[index]

  function reset() {
    setIndex(0); setSelected(null); setShowAnswer(false); setScore(0); setFinished(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function confirm() {
    if (selected === null) return
    const correct = selected === question.correct_index
    if (correct) setScore((s) => s + 1)
    setShowAnswer(true)
  }

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true)
      onFinish(score, questions.length)
    } else {
      setIndex((i) => i + 1)
      setSelected(null)
      setShowAnswer(false)
    }
  }

  if (questions.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {finished ? (
          <div className="text-center py-6 space-y-3">
            <p className="text-3xl font-bold text-foreground">{score}/{questions.length}</p>
            <p className="text-muted-foreground">
              {score / questions.length >= 0.7 ? 'Mandou bem!' : 'Vale revisar o conteúdo e tentar de novo.'}
            </p>
            <Button onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Pergunta {index + 1} de {questions.length}</p>
            <p className="font-medium text-foreground">{question.question}</p>
            <RadioGroup
              value={selected !== null ? String(selected) : undefined}
              onValueChange={(v) => !showAnswer && setSelected(Number(v))}
            >
              {question.options.map((opt, i) => {
                const isCorrect = showAnswer && i === question.correct_index
                const isWrongPick = showAnswer && i === selected && i !== question.correct_index
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border border-border/50 p-2',
                      isCorrect && 'border-green-500/60 bg-green-500/10',
                      isWrongPick && 'border-red-500/60 bg-red-500/10',
                    )}
                  >
                    <RadioGroupItem value={String(i)} id={`q-${index}-${i}`} disabled={showAnswer} />
                    <Label htmlFor={`q-${index}-${i}`} className="flex-1 cursor-pointer font-normal">{opt}</Label>
                  </div>
                )
              })}
            </RadioGroup>
            {showAnswer && question.explanation && (
              <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg p-3">{question.explanation}</p>
            )}
            <div className="flex justify-end gap-2">
              {!showAnswer ? (
                <Button onClick={confirm} disabled={selected === null}>Confirmar</Button>
              ) : (
                <Button onClick={next}>{index + 1 >= questions.length ? 'Ver resultado' : 'Próxima'}</Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
