import type { OficinaDiretaDeckProps } from './types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Slide09Prova(_props: OficinaDiretaDeckProps) {
  return (
    <section className="od-section">
      <p className="od-eyebrow">A prova financeira do sistema</p>
      <h2 className="od-title">Métrica clara: o sistema se paga nos primeiros retornos.</h2>
      <p className="od-lede">
        Este é o Dashboard de Retornos — ele mostra exatamente quantos clientes voltaram por conta das mensagens
        automatizadas, e o faturamento gerado por esses retornos. Benchmark real de fevereiro/26.
      </p>

      <div className="od-proof-grid">
        <div className="od-proof-stat"><div className="v">170+</div><div className="k">oficinas parceiras</div></div>
        <div className="od-proof-stat"><div className="v">13,7%</div><div className="k">taxa de retorno de clientes</div></div>
        <div className="od-proof-stat"><div className="v">R$ 1,56 M</div><div className="k">gerados para a base</div></div>
        <div className="od-proof-stat"><div className="v">NPS 90</div><div className="k">satisfação das oficinas</div></div>
      </div>

      <div className="od-trust-strip">
        <span className="od-trust-chip">Fit de produto garantido</span>
        <span className="od-trust-chip">Integrações nativas com os principais ERPs do mercado</span>
        <span className="od-trust-chip">Centenas de oficinas e auto centers já automatizaram o pós-venda</span>
      </div>
    </section>
  )
}
