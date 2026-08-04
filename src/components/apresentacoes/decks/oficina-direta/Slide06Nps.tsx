import type { OficinaDiretaDeckProps } from './types'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Slide06Nps(_props: OficinaDiretaDeckProps) {
  return (
    <section className="od-section">
      <p className="od-eyebrow">Reputação</p>
      <h2 className="od-title">Mensure a satisfação com NPS.</h2>

      <div className="od-grid-2">
        <div className="od-card-dark od-nps-stat">
          <div className="od-nps-value">90</div>
          <div style={{ fontSize: 12, color: 'var(--od-ink-soft)' }}>/ 100 — Zona de Excelência</div>
          <div className="od-nps-bar"><div className="fill" style={{ width: '90%' }} /></div>
          <p className="od-nps-label">NPS médio das oficinas parceiras Prema</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="od-card-dark">
            <h5 style={{ margin: 0, fontSize: 13.5, color: '#fff' }}>Pesquisa Automática</h5>
            <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--od-ink-soft)', lineHeight: 1.45 }}>
              Link de satisfação disparado logo após o atendimento — zero cliques da sua equipe.
            </p>
          </div>
          <div className="od-card-dark">
            <h5 style={{ margin: 0, fontSize: 13.5, color: '#fff' }}>Antecipação de Detratores</h5>
            <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--od-ink-soft)', lineHeight: 1.45 }}>
              O gestor monitora em tempo real e resolve problemas antes que o cliente publique uma reclamação.
            </p>
          </div>
          <div className="od-card-dark">
            <h5 style={{ margin: 0, fontSize: 13.5, color: '#fff' }}>Gatilho de Avaliação</h5>
            <p style={{ margin: '6px 0 0 0', fontSize: 12, color: 'var(--od-ink-soft)', lineHeight: 1.45 }}>
              Impulsiona automaticamente as notas no Google Meu Negócio, pedindo reviews a clientes promotores.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
