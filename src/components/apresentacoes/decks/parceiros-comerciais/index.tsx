import '@/styles/prema-deck.css'
import { Slide01Cover } from './Slide01Cover'
import { Slide02Problema } from './Slide02Problema'
import { Slide03OQueAPremaFaz } from './Slide03OQueAPremaFaz'
import { Slide04Diferenciais } from './Slide04Diferenciais'
import { Slide05ProvaDeResultado } from './Slide05ProvaDeResultado'
import { Slide06PerfilDePublico } from './Slide06PerfilDePublico'
import { Slide07ComoIndicar } from './Slide07ComoIndicar'
import { Slide08Contato } from './Slide08Contato'
import type { ParceirosComerciaisDeckProps } from './types'

export type { ParceirosComerciaisDeckProps }

/**
 * Deck "Parceiros Comerciais" — página única com rolagem vertical (não um
 * viewer de slides paginado), fiel ao Prema Design System (Arlon, roxo
 * #612c7d, fundo #ededed). Tokens e classes vêm de src/styles/prema-deck.css,
 * escopados sob .prema-deck-scope para não vazar no tema do app.
 */
export function ParceirosComerciaisDeck(props: ParceirosComerciaisDeckProps) {
  return (
    <div className="prema-deck-scope">
      <Slide01Cover {...props} />
      <Slide02Problema />
      <Slide03OQueAPremaFaz />
      <Slide04Diferenciais />
      <Slide05ProvaDeResultado />
      <Slide06PerfilDePublico />
      <Slide07ComoIndicar />
      <Slide08Contato {...props} />
    </div>
  )
}
