const STEPS = [
  { n: '01', h: 'Identifique', p: 'Um gestor de oficina ou auto center, na sua base ou rede, que sente uma das dores deste documento.' },
  { n: '02', h: 'Apresente', p: '2 minutos bastam — mostre este documento ou fale do resultado: 13,7% de retorno, R$1,56M gerados.' },
  { n: '03', h: 'Conecte', p: 'Nos apresenta com uma mensagem simples. O time comercial da Prema assume a condução a partir daí.' },
  { n: '04', h: 'Acompanhe', p: 'Você recebe retorno sobre o andamento da indicação junto ao time comercial.' },
]

const TRIGGERS = [
  'Cliente comenta que a oficina "some" depois do serviço',
  'Gestor reclama de agenda vazia sem saber o motivo',
  'Oficina sem nenhum processo de pós-venda',
  'Rede que perdeu visibilidade da base entre unidades',
]

export function Slide07ComoIndicar() {
  return (
    <section className="pd-section">
      <p className="pd-eyebrow">Como funciona a indicação</p>
      <h2 className="pd-title">Toda apresentação sua é uma indicação em potencial.</h2>
      <p className="pd-lede">
        Você circula com pessoas que representam exatamente o perfil que a Prema mais precisa conhecer agora.
        Uma conversa de 2 minutos já basta.
      </p>

      <div className="pd-grid-2-eq" style={{ marginTop: 24 }}>
        {STEPS.map(s => (
          <div key={s.n} className="pd-indicate-step">
            <div className="n">{s.n}</div>
            <h5>{s.h}</h5>
            <p>{s.p}</p>
          </div>
        ))}
      </div>

      <div>
        <h5 style={{ fontSize: 12, color: 'var(--pd-ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginTop: 24, marginBottom: 0 }}>
          Gatilhos que valem uma indicação
        </h5>
        <div className="pd-trigger-chips">
          {TRIGGERS.map(t => <div key={t} className="pd-trigger-chip">{t}</div>)}
        </div>
      </div>

      <div className="pd-takeaway">
        É simples assim: você identifica e conecta. A partir daí, o time comercial da Prema conduz toda a
        apresentação, o trial e a negociação.
      </div>
    </section>
  )
}
