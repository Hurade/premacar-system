import { VERTICAL_CONTENT } from './content'
import type { OficinaDiretaDeckProps } from './types'

export function Slide02Dores({ atuacaoPrincipal }: OficinaDiretaDeckProps) {
  const v = VERTICAL_CONTENT[atuacaoPrincipal ?? 'outro']

  return (
    <section className="od-section">
      <p className="od-eyebrow">Estratégia é tudo</p>
      <h2 className="od-title">A execução manual custa caro.</h2>
      <p className="od-lede">
        Depender de envios manuais no WhatsApp para lembrar o cliente de voltar para {v.label} cria gargalos
        invisíveis que aparecem só no fim do mês.
      </p>

      <div className="od-grid-3">
        {v.painCards.map(c => (
          <div key={c.title} className="od-card od-pain-card">
            <h5>{c.title}</h5>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
