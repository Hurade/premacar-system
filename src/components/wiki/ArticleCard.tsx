import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import type { WikiSearchResult } from '@/types/wiki'

interface Props {
  article: WikiSearchResult
}

export function ArticleCard({ article }: Props) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(`/wiki/artigo/${article.id}`)}
      className="w-full text-left bg-card/60 backdrop-blur-sm border border-border/50 rounded-2xl p-4 hover:border-primary/40 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge variant="secondary" className="text-xs">{article.area}</Badge>
        <Badge variant="outline" className="text-xs">{article.system}</Badge>
        {article.category && <span className="text-xs text-muted-foreground">{article.category}</span>}
      </div>
      <h3 className="font-semibold text-foreground mb-1">{article.title}</h3>
      <p className="text-sm text-muted-foreground line-clamp-2">{article.description}</p>
      {article.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {article.tags.slice(0, 5).map((t) => (
            <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{t}</span>
          ))}
        </div>
      )}
    </button>
  )
}
