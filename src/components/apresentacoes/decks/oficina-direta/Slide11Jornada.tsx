import type { OficinaDiretaDeckProps } from './types'

export function Slide11Jornada({ temErp, erpNome }: OficinaDiretaDeckProps) {
  const integracaoDesc = temErp
    ? `Sua integração com ${erpNome || 'seu sistema de gestão'} já está mapeada — a implantação é direta.`
    : 'Vamos te ajudar a estruturar o histórico de OS, mesmo sem um sistema de gestão hoje.'

  return (
    <section className="od-section">
      <p className="od-eyebrow">Jornada de conversão</p>
      <h2 className="od-title">Próximos passos.</h2>

      <div className="od-grid-3">
        <div className="od-card-dark od-process-step">
          <span className="n">01</span>
          <h5>Aprovação da Proposta</h5>
          <p>E reunião inicial para definir como tudo vai funcionar.</p>
        </div>
        <div className="od-card-dark od-process-step">
          <span className="n">02</span>
          <h5>Integração Rápida</h5>
          <p>{integracaoDesc}</p>
        </div>
        <div className="od-card-dark od-process-step">
          <span className="n">03</span>
          <h5>Ligando a Máquina</h5>
          <p>Automação ativada. A partir de hoje nossos agentes trabalham para você.</p>
        </div>
      </div>

      <div className="od-card-dark" style={{ marginTop: 20, textAlign: 'center', borderColor: 'var(--od-gold)' }}>
        <strong style={{ color: 'var(--od-gold)', fontSize: 15 }}>Faturar mais, com menos custo.</strong>
      </div>
    </section>
  )
}
