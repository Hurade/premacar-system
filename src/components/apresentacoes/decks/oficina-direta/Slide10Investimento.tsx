import { PLANOS_PADRAO, formatarMoeda } from '@/types/propostas'
import type { PlanoTipo } from '@/types/apresentacoes'
import type { OficinaDiretaDeckProps } from './types'

const ORDER: PlanoTipo[] = ['mensurar', 'fidelizar', 'recuperar']

export function Slide10Investimento({ estrategiaInicial }: OficinaDiretaDeckProps) {
  const estrategia = estrategiaInicial ?? 'fidelizar'
  const idx = ORDER.indexOf(estrategia)
  const altTipo = idx < ORDER.length - 1 ? ORDER[idx + 1] : ORDER[idx - 1]

  const recomendado = PLANOS_PADRAO[estrategia]
  const alternativo = PLANOS_PADRAO[altTipo]

  return (
    <section className="od-section od-light">
      <div className="od-inner">
        <p className="od-eyebrow">Investimento</p>
        <h2 className="od-title">Portal de Gestão dos Clientes.</h2>
        <p className="od-lede">
          Entendemos o volume de atendimentos (VAT) da sua operação. Nossa proposta escala com o seu tamanho:
          quanto mais unidades e clientes processados, mais agressivo é o seu desconto na adoção dos planos.
        </p>

        <div className="od-grid-2">
          <div>
            <div className="od-plan-ribbon" style={{ background: '#e4dcf3', color: '#5a3a8a' }}>Plano {alternativo.nome.replace('Plano ', '')}</div>
            <div className="od-plan-card alternativo">
              <h4>{alternativo.nome}</h4>
              <div className="preco">{formatarMoeda(alternativo.preco)}/mês por unidade</div>
              <ul>
                {alternativo.recursos.slice(0, 3).map(r => <li key={r}>{r}</li>)}
              </ul>
            </div>
          </div>

          <div>
            <div className="od-plan-ribbon">Até 40% de desconto progressivo</div>
            <div className="od-plan-card recomendado">
              <span className="od-plan-badge">Recomendado</span>
              <h4>{recomendado.nome}</h4>
              <div className="preco">{formatarMoeda(recomendado.preco)}/mês por unidade</div>
              <ul>
                {recomendado.recursos.slice(0, 3).map(r => <li key={r}>{r}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
