import type { ParceirosComerciaisDeckProps } from './types'

export function Slide01Cover({ empresa, responsavel, tituloPersonalizado }: ParceirosComerciaisDeckProps) {
  return (
    <section className="pd-section pd-cover">
      <div className="pd-cover-inner">
        <img src="/prema-logo.png" alt="Prema" className="pd-cover-logo" />
        <p className="pd-eyebrow">Prema · Documento para Parceiros Comerciais</p>
        <h1 className="pd-title">O carro lembra sozinho do seu Roberto.</h1>
        {(tituloPersonalizado || responsavel || empresa) && (
          <p style={{ color: '#fff', fontWeight: 600, fontSize: 15, marginTop: 12 }}>
            {tituloPersonalizado || `Preparado especialmente para ${responsavel ?? ''}${responsavel && empresa ? ' — ' : ''}${empresa ?? ''}`}
          </p>
        )}
        <p className="pd-lede">
          A Prema é o motor que transforma o histórico de ordens de serviço do ERP em retorno automático de
          clientes pelo WhatsApp — sem que a oficina precise disparar, segmentar ou lembrar de nada.
        </p>

        <div className="pd-cover-stats">
          <div className="pd-cover-stat"><div className="v">170+</div><div className="k">Robertos pagantes</div></div>
          <div className="pd-cover-stat"><div className="v">NPS 90</div><div className="k">satisfação das oficinas clientes</div></div>
          <div className="pd-cover-stat"><div className="v">R$ 1,56 M</div><div className="k">gerados p/ base em Fev/26</div></div>
          <div className="pd-cover-stat"><div className="v">13,7%</div><div className="k">taxa de retorno de clientes</div></div>
        </div>
      </div>
    </section>
  )
}
