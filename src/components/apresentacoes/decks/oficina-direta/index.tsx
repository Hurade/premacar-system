import '@/styles/oficina-direta-deck.css'
import { Slide01Cover } from './Slide01Cover'
import { Slide02Dores } from './Slide02Dores'
import { Slide03Paradigma } from './Slide03Paradigma'
import { Slide04Motor } from './Slide04Motor'
import { Slide05ZeroClick } from './Slide05ZeroClick'
import { Slide06Nps } from './Slide06Nps'
import { Slide07Bonus } from './Slide07Bonus'
import { Slide08Objecoes } from './Slide08Objecoes'
import { Slide09Prova } from './Slide09Prova'
import { Slide10Investimento } from './Slide10Investimento'
import { Slide11Jornada } from './Slide11Jornada'
import { Slide12Contato } from './Slide12Contato'
import type { OficinaDiretaDeckProps } from './types'

export type { OficinaDiretaDeckProps }

/**
 * Deck "Oficina / Auto Center" — venda direta, tema próprio (roxo escuro +
 * dourado), fiel aos decks de referência "PremaCar Troca de Óleo" / "PremaCar
 * Pneus". Conteúdo das seções 2-7 e 11 varia por `atuacaoPrincipal` — ver
 * ./content.ts.
 */
export function OficinaDiretaDeck(props: OficinaDiretaDeckProps) {
  return (
    <div className="prema-oficina-scope">
      <Slide01Cover {...props} />
      <Slide02Dores {...props} />
      <Slide03Paradigma {...props} />
      <Slide04Motor {...props} />
      <Slide05ZeroClick {...props} />
      <Slide06Nps {...props} />
      <Slide07Bonus {...props} />
      <Slide08Objecoes {...props} />
      <Slide09Prova {...props} />
      <Slide10Investimento {...props} />
      <Slide11Jornada {...props} />
      <Slide12Contato {...props} />
    </div>
  )
}
