import type { ParceirosComerciaisDeckProps } from './types'

export function Slide08Contato({ assinaturaVendedor }: ParceirosComerciaisDeckProps) {
  const nome = assinaturaVendedor?.nome
  const email = assinaturaVendedor?.email || 'comercial@premacar.com.br'
  const cargo = assinaturaVendedor?.cargo || 'Time Comercial · Prema'

  return (
    <section className="pd-section pd-closing">
      <div className="pd-closing-inner">
        <p className="pd-eyebrow">Vamos conversar</p>
        <h2 className="pd-title">Vamos fazer o carro lembrar por mais Robertos.</h2>
        <p className="pd-lede">
          Dúvidas sobre o produto, uma indicação para conectar, ou quer ver a plataforma ao vivo antes de indicar
          — é só chamar.
        </p>

        <div className="pd-contact-card">
          <div className="ico">{(nome ?? '@').charAt(0).toUpperCase()}</div>
          <div>
            <div className="email">{nome ? nome : email}</div>
            <div className="role">{nome ? `${cargo} · ${email}` : cargo}</div>
          </div>
        </div>
      </div>
      <div className="pd-footer">Prema · comercial@premacar.com.br</div>
    </section>
  )
}
