import { VERTICAL_CONTENT } from './content'
import type { OficinaDiretaDeckProps } from './types'

export function Slide05ZeroClick({ atuacaoPrincipal }: OficinaDiretaDeckProps) {
  const v = VERTICAL_CONTENT[atuacaoPrincipal ?? 'outro']

  return (
    <section className="od-section">
      <p className="od-eyebrow">Automação e zero-click</p>
      <h2 className="od-title">O.S. fechada no sistema. Prema assume o resto.</h2>
      <p className="od-lede">
        Prema calcula o retorno pelo tipo de serviço/produto e chama o cliente sozinha — sem depender de ninguém
        lembrar, sem depender de ninguém clicar.
      </p>

      <div className="od-wa-bubble">
        <div className="from">WhatsApp · Prema envia em nome da oficina</div>
        <p>"{v.exampleMessage}"</p>
      </div>
      <div className="od-trigger-pill">Gatilho automático: {v.triggerLabel}</div>

      <div className="od-card-dark" style={{ marginTop: 22 }}>
        <h5 style={{ margin: 0, fontSize: 14, color: '#fff' }}>Proteção contra rotatividade</h5>
        <p style={{ margin: '6px 0 0 0', fontSize: 12.5, color: 'var(--od-ink-soft)', lineHeight: 1.5 }}>
          Se toda a sua recepção for trocada hoje, o seu fluxo de retornos de amanhã está 100% garantido — o
          conhecimento fica no sistema, não na cabeça de uma pessoa.
        </p>
      </div>
    </section>
  )
}
