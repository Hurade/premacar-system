import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWikiModuleArticles, useWikiModuleQuiz, useMarkModuleStudied, useSubmitModuleQuiz, useWikiProgress } from '@/hooks/useWiki'
import { QuizModal } from './QuizModal'

interface Props {
  moduleId: string
  onBack: () => void
}

export function ModuloDetalhe({ moduleId, onBack }: Props) {
  const navigate = useNavigate()
  const { data: articles } = useWikiModuleArticles(moduleId)
  const { data: quiz } = useWikiModuleQuiz(moduleId)
  const { data: progress } = useWikiProgress()
  const markStudied = useMarkModuleStudied()
  const submitQuiz = useSubmitModuleQuiz()
  const [quizOpen, setQuizOpen] = useState(false)

  const myProgress = progress?.find((p) => p.module_id === moduleId)

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4" /> Voltar pra trilha
      </button>

      <div className="space-y-2">
        {(articles ?? []).map((ma) => (
          <button
            key={ma.article_id}
            onClick={() => navigate(`/wiki/artigo/${ma.article_id}`)}
            className="w-full flex items-center gap-3 bg-card/60 border border-border/50 rounded-xl p-3 text-left hover:border-primary/40 transition-colors"
          >
            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground">{ma.article.title}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border/40">
        <Button
          onClick={() => markStudied.mutate(moduleId)}
          disabled={!!myProgress?.studied_at || markStudied.isPending}
          variant={myProgress?.studied_at ? 'secondary' : 'default'}
          className="gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          {myProgress?.studied_at ? 'Já estudado' : 'Marcar como estudado'}
        </Button>
        {(quiz ?? []).length > 0 && (
          <Button variant="outline" onClick={() => setQuizOpen(true)}>Fazer quiz do módulo</Button>
        )}
      </div>

      <QuizModal
        open={quizOpen}
        onClose={() => setQuizOpen(false)}
        title="Quiz do módulo"
        questions={quiz ?? []}
        onFinish={(score, total) => submitQuiz.mutate({ moduleId, score, total })}
      />
    </div>
  )
}
