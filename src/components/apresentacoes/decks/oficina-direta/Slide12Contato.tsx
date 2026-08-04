import type { OficinaDiretaDeckProps } from './types'

export function Slide12Contato({ assinaturaVendedor }: OficinaDiretaDeckProps) {
  const nome = assinaturaVendedor?.nome
  const email = assinaturaVendedor?.email || 'comercial@premacar.com.br'
  const cargo = assinaturaVendedor?.cargo || 'Time Comercial · Prema'

  return (
    <section className="od-section od-closing">
      <p className="od-eyebrow">Obrigado!</p>
      <h2 className="od-title">Impulsione o crescimento da sua oficina hoje.</h2>
      <p className="od-lede">Fale diretamente com nossos especialistas e inicie sua transformação.</p>

      <div className="od-contact-card">
        <div className="ico">{(nome ?? '@').charAt(0).toUpperCase()}</div>
        <div>
          <div className="email">{nome ? nome : email}</div>
          <div className="role">{nome ? `${cargo} · ${email}` : cargo}</div>
        </div>
      </div>
      <div className="od-footer">Prema · comercial@premacar.com.br</div>
    </section>
  )
}
