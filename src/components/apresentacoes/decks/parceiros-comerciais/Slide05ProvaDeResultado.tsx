const FUNNEL_STEPS = [
  { n: 1, t: 'Enviada' },
  { n: 2, t: 'Visualizada' },
  { n: 3, t: 'Respondeu' },
  { n: 4, t: 'Agendou' },
  { n: 5, t: 'Apareceu' },
  { n: 6, t: 'Pagou' },
]

export function Slide05ProvaDeResultado() {
  return (
    <section className="pd-section">
      <p className="pd-eyebrow">Prova de resultado</p>
      <h2 className="pd-title">Cada cliente, rastreado do primeiro toque ao pagamento.</h2>
      <p className="pd-lede">
        A perda invisível exige prova visível. A Prema acompanha o funil completo — e mostra exatamente quantos
        retornos, quanto faturamento e qual lucro bruto foram gerados.
      </p>

      <div className="pd-funnel">
        {FUNNEL_STEPS.map(s => (
          <div key={s.n} className={`pd-funnel-step pd-fs-${s.n}`}>
            <div className="n">{s.n}</div>
            <div className="t">{s.t}</div>
          </div>
        ))}
      </div>

      <div className="pd-grid-2">
        <div className="pd-card pd-benchmark-card">
          <h4 style={{ margin: 0, fontSize: 13.5, color: 'var(--pd-ink-soft)' }}>Benchmark real · Fevereiro 2026</h4>
          <p style={{ fontSize: 15, fontWeight: 700, marginTop: 10, marginBottom: 0 }}>
            14.500 mensagens <span style={{ color: 'var(--pd-ink-soft)', fontWeight: 500 }}>→</span> 1.992 retornos (13,7%)
          </p>
          <div className="pd-benchmark-total">R$ 1.566.273,58 gerados</div>
          <div className="pd-mini-stats">
            <div className="pd-mini-stat"><div className="v">NPS 90</div><div className="k">satisfação das oficinas</div></div>
            <div className="pd-mini-stat"><div className="v">35,78%</div><div className="k">taxa de resposta às pesquisas</div></div>
          </div>
        </div>

        <div className="pd-card pd-north-star">
          <h5>North star</h5>
          <p><strong style={{ color: 'var(--pd-ink-strong)' }}>Receita Estimada Atribuída</strong> = soma do faturamento de todo cliente que completou o funil, calculada sobre margens reais (MO 100% · Peças 50% · Pneus 15%).</p>
          <h5>Grupo de controle</h5>
          <p>Comparação entre clientes contatados vs. não contatados — mais convincente que número absoluto isolado.</p>
          <h5>Transparência</h5>
          <p>Rótulo "estimado" é deliberado: protege o gestor de conflito com a contabilidade real da oficina.</p>
        </div>
      </div>

      <div className="pd-takeaway">
        Cada real gerado é rastreável do disparo da mensagem até o pagamento na oficina — não é uma estimativa de
        campanha de marketing.
      </div>
    </section>
  )
}
