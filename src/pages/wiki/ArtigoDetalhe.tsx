import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useWikiArticle } from '@/hooks/useWiki'

export default function ArtigoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: article, isLoading } = useWikiArticle(id)

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Carregando...</div>
  }

  if (!article) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <AlertCircle className="w-10 h-10 text-muted-foreground" />
        <p className="text-muted-foreground">Artigo não encontrado</p>
        <button onClick={() => navigate('/wiki')} className="text-primary text-sm">Voltar pra Wiki</button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge variant="secondary">{article.area}</Badge>
            <Badge variant="outline">{article.system}</Badge>
            {article.category && <span className="text-xs text-muted-foreground">{article.category}</span>}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{article.title}</h1>
        </div>

        <p className="text-foreground">{article.description}</p>

        {article.causes.length > 0 && (
          <Section title="Causas prováveis">
            <ul className="list-disc list-inside space-y-1 text-sm text-foreground">
              {article.causes.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </Section>
        )}

        {article.steps.length > 0 && (
          <Section title="Passo a passo">
            <ol className="list-decimal list-inside space-y-2 text-sm text-foreground">
              {article.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </Section>
        )}

        {article.observations.length > 0 && (
          <Section title="Observações">
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {article.observations.map((o, i) => <li key={i}>{o}</li>)}
            </ul>
          </Section>
        )}

        {article.tools.length > 0 && (
          <Section title="Ferramentas/links usados">
            <div className="flex flex-wrap gap-2">
              {article.tools.map((t, i) => (
                <span key={i} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">{t}</span>
              ))}
            </div>
          </Section>
        )}

        {article.escalate && (
          <Section title="Quando escalar">
            <p className="text-sm text-foreground">{article.escalate}</p>
          </Section>
        )}

        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2 border-t border-border/40">
            {article.tags.map((t) => (
              <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  )
}
