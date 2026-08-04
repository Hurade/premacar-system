import { VERTICAL_CONTENT } from './content'
import type { OficinaDiretaDeckProps } from './types'

export function Slide07Bonus({ atuacaoPrincipal }: OficinaDiretaDeckProps) {
  const v = VERTICAL_CONTENT[atuacaoPrincipal ?? 'outro']

  return (
    <section className="od-section">
      <p className="od-eyebrow">Bônus, cashback e recuperação</p>
      <h2 className="od-title">A isca perfeita para o cliente voltar.</h2>

      <div className="od-grid-2">
        <div className="od-wallet">
          <span className="balance-label">Saldo Prema · Carteira do cliente</span>
          <div className="balance-value">R$ 50,00</div>
          <div className="bonus-note">Você tem R$ 50 de bônus disponível hoje!</div>
          <p style={{ fontSize: 12, color: 'var(--od-ink-soft)', marginTop: 14, lineHeight: 1.5 }}>
            Substitui descontos genéricos por saldo retido. O cliente sente que está "perdendo dinheiro" se não
            voltar — e o ticket médio aumenta, porque ele compra serviços adicionais ao usar o bônus.
          </p>
        </div>

        <div className="od-card-dark">
          <h5 style={{ margin: 0, fontSize: 14, color: '#fff' }}>Recuperação de Inativos</h5>
          <div className="od-recovery-flow">
            <div className="step">{v.recoveryQuestion}</div>
            <div className="step">
              O sistema entra em modo de esteira de reengajamento, oferecendo condições especiais escalonadas
              para trazer o cliente de volta à base.
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
