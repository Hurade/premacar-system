import { useWikiManagerPanel } from '@/hooks/useWiki'

export function PainelGestor() {
  const { progress, gaps, feedback } = useWikiManagerPanel()

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">Progresso do time</h3>
        <div className="bg-card/60 border border-border/50 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-muted-foreground text-xs">
              <tr>
                <th className="text-left p-3">Nome</th>
                <th className="text-left p-3">Trilha</th>
                <th className="text-left p-3">Módulos estudados</th>
                <th className="text-left p-3">% completo</th>
                <th className="text-left p-3">Média quiz</th>
              </tr>
            </thead>
            <tbody>
              {(progress.data ?? []).map((row, i) => (
                <tr key={i} className="border-t border-border/30">
                  <td className="p-3 text-foreground">{row.name}</td>
                  <td className="p-3 text-muted-foreground">{row.track}</td>
                  <td className="p-3 text-muted-foreground">{row.studied_modules}/{row.total_modules}</td>
                  <td className="p-3 text-muted-foreground">{row.pct_studied != null ? `${row.pct_studied}%` : '—'}</td>
                  <td className="p-3 text-muted-foreground">{row.avg_quiz_ratio != null ? `${Math.round(row.avg_quiz_ratio * 100)}%` : '—'}</td>
                </tr>
              ))}
              {(progress.data ?? []).length === 0 && (
                <tr><td colSpan={5} className="p-3 text-muted-foreground text-center">Nenhum dado ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">Lacunas (perguntas sem resposta na base)</h3>
        <div className="space-y-2">
          {(gaps.data ?? []).map((q) => (
            <div key={q.id} className="bg-card/60 border border-amber-500/30 rounded-xl p-3 text-sm">
              <p className="text-foreground">{q.question}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {q.agent} · {new Date(q.created_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          ))}
          {(gaps.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma lacuna registrada.</p>}
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-foreground mb-2">Feedback negativo</h3>
        <div className="space-y-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(feedback.data ?? []).map((f: any) => (
            <div key={f.id} className="bg-card/60 border border-red-500/30 rounded-xl p-3 text-sm">
              <p className="text-foreground">{f.query?.question}</p>
              <p className="text-xs text-muted-foreground mt-1">{f.query?.agent} · {new Date(f.created_at).toLocaleDateString('pt-BR')}</p>
            </div>
          ))}
          {(feedback.data ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum feedback negativo.</p>}
        </div>
      </section>
    </div>
  )
}
