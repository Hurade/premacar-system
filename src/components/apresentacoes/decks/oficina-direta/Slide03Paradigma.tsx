import { VERTICAL_CONTENT } from './content'
import type { OficinaDiretaDeckProps } from './types'

export function Slide03Paradigma({ atuacaoPrincipal }: OficinaDiretaDeckProps) {
  const v = VERTICAL_CONTENT[atuacaoPrincipal ?? 'outro']

  return (
    <section className="od-section od-light">
      <div className="od-inner">
        <p className="od-eyebrow">O paradigma</p>
        <h2 className="od-title">Dependência humana <span className="accent">vs.</span> automação invisível.</h2>

        <div className="od-grid-2">
          <div className="od-card od-before">
            <h4 style={{ margin: 0, fontSize: 15, color: '#b3402a' }}>O Padrão do Mercado</h4>
            <div className="od-timeline" style={{ marginTop: 14 }}>
              <div className="od-timeline-step"><span className="dot" />O cliente sai da oficina hoje.</div>
              <div className="od-timeline-step"><span className="dot" />A nota é emitida e ele vai embora.</div>
              <div className="od-timeline-step"><span className="dot" />A equipe precisa lembrar de anotar na agenda.</div>
              <div className="od-timeline-step"><span className="dot" />Meses depois, alguém precisa parar o trabalho para mandar um WhatsApp manual.</div>
            </div>
            <div className="od-result-box">Alta taxa de esquecimento e perda do cliente.</div>
          </div>

          <div className="od-card od-after">
            <h4 style={{ margin: 0, fontSize: 15, color: '#2f7a54' }}>O Ecossistema Prema</h4>
            <div className="od-timeline" style={{ marginTop: 14 }}>
              <div className="od-timeline-step"><span className="dot" />O cliente sai da oficina hoje.</div>
              <div className="od-timeline-step"><span className="dot" />O sistema captura a OS automaticamente.</div>
              <div className="od-timeline-step"><span className="dot" /><strong>Ninguém clica em nada.</strong></div>
              <div className="od-timeline-step"><span className="dot" />No momento certo — {v.triggerLabel} — o sistema dispara o aviso automático, com bônus.</div>
            </div>
            <div className="od-result-box">O cliente agenda o retorno, aumentando o faturamento sem esforço manual.</div>
          </div>
        </div>
      </div>
    </section>
  )
}
