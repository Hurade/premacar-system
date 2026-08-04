import { VERTICAL_CONTENT } from './content'
import type { OficinaDiretaDeckProps } from './types'

export function Slide04Motor({ atuacaoPrincipal }: OficinaDiretaDeckProps) {
  const v = VERTICAL_CONTENT[atuacaoPrincipal ?? 'outro']

  return (
    <section className="od-section">
      <p className="od-eyebrow">O motor de pós-venda</p>
      <h2 className="od-title">Uma engrenagem perfeita, onde cada módulo alimenta o faturamento do próximo.</h2>
      <p className="od-lede">Vamos abrir o capô.</p>

      <div className="od-grid-4">
        {v.cycleStages.map(s => (
          <div key={s.day} className="od-card-dark od-cycle-step">
            <span className="day">{s.day}</span>
            <h5>{s.title}</h5>
            <p>{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
