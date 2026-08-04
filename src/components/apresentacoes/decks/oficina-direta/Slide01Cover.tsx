import type { OficinaDiretaDeckProps } from './types'

export function Slide01Cover({ empresa, responsavel, tituloPersonalizado }: OficinaDiretaDeckProps) {
  return (
    <section className="od-section od-cover">
      <img src="/prema-logo.png" alt="Prema" className="od-cover-logo" />
      <p className="od-eyebrow">Prema · Portal de Gestão de Clientes</p>
      <h1 className="od-title">
        Assuma o controle <span className="accent">definitivo</span> do pós-venda.
      </h1>
      {(tituloPersonalizado || responsavel || empresa) && (
        <p className="od-personal-line">
          {tituloPersonalizado || `Preparado especialmente para ${responsavel ?? ''}${responsavel && empresa ? ' — ' : ''}${empresa ?? ''}`}
        </p>
      )}
      <p className="od-lede" style={{ marginLeft: 'auto', marginRight: 'auto' }}>
        O ecossistema de fidelização 100% online, zero cliques e exclusivo para a realidade de oficinas e auto centers.
      </p>
    </section>
  )
}
