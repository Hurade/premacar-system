const OBJECOES = [
  {
    q: '"Já uso um concorrente"',
    mito: 'Acha que envios em massa ou agendas manuais são CRM.',
    real: 'Automação inteligente baseada no histórico real da OS. Comunicação hiper-personalizada, não spam genérico.',
  },
  {
    q: '"Tive má experiência no passado"',
    mito: 'Softwares dão trabalho para implantar e a equipe não usa.',
    real: '100% online, sem instalação. O sistema roda nos bastidores — se a equipe não clicar em nada, ele continua faturando.',
  },
  {
    q: '"Não sei se funciona para mim"',
    mito: 'Acha que o seu auto center é diferente demais.',
    real: 'Foco exclusivo no mercado automotivo, desenhado para a jornada exata de serviços recorrentes (óleo, alinhamento, pneus, revisão).',
  },
]

import type { OficinaDiretaDeckProps } from './types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Slide08Objecoes(_props: OficinaDiretaDeckProps) {
  return (
    <section className="od-section od-light">
      <div className="od-inner">
        <p className="od-eyebrow">Desconstruindo objeções</p>
        <h2 className="od-title">Por que a Prema é diferente?</h2>

        <div className="od-grid-3">
          {OBJECOES.map(o => (
            <div key={o.q} className="od-card od-objection-card">
              <h5>{o.q}</h5>
              <p className="mito"><b>O mito:</b> {o.mito}</p>
              <p className="real"><b>A realidade Prema:</b> {o.real}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
