export function Slide02Problema() {
  return (
    <section className="pd-section">
      <p className="pd-eyebrow">O problema</p>
      <h2 className="pd-title">Clientes evaporam em silêncio.</h2>
      <p className="pd-lede">
        O ERP registra o passado — quem veio, o que fez, quando. Mas não converte esse histórico em ação futura.
        O gestor não sabe quem está perto do ciclo de troca, não tem critério para "inativo", e não sabe o que
        escrever sem parecer insistente.
      </p>

      <div className="pd-grid-2">
        <div>
          <div className="pd-quote">
            <p>"Onde foram os outros?"</p>
            <div className="src">— frase que todo gestor de oficina pensa, toda sexta-feira, ao fechar o caixa</div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--pd-ink-soft)', marginTop: 18, lineHeight: 1.55 }}>
            <strong style={{ color: 'var(--pd-ink-strong)' }}>A causa real não é falta de vontade de agir.</strong>{' '}
            É a inexistência de um sistema que converta dados passados em ações automáticas futuras. O setor
            automotivo ainda está atrasado em automação de recorrência — esse gap é a oportunidade que você
            identifica em cada oficina que visita ou atende.
          </p>
        </div>

        <div className="pd-card pd-scale-card">
          <h4 style={{ margin: 0, fontSize: 13.5, color: 'var(--pd-ink-soft)', fontWeight: 600 }}>
            Escala do problema — um exemplo real
          </h4>
          <p style={{ fontSize: 15, fontWeight: 700, marginTop: 10, marginBottom: 0 }}>
            Rede de 10 lojas <span style={{ color: 'var(--pd-ink-soft)', fontWeight: 500 }}>perde</span> ~400 clientes/mês
          </p>
          <p style={{ fontSize: 13, color: 'var(--pd-ink-soft)', marginTop: 4, marginBottom: 0 }}>a ticket médio R$ 800</p>
          <div className="pd-scale-total">= R$ 320 mil/mês</div>
          <p style={{ fontSize: 12, color: 'var(--pd-ink-soft)', lineHeight: 1.5, marginTop: 10 }}>
            …que aparecem no P&amp;L só como "esse mês foi fraco". Nenhuma linha de custo mostra essa perda — por
            isso ela nunca é priorizada sem alguém de fora apontando.
          </p>
        </div>
      </div>

      <div className="pd-grid-4">
        <div className="pd-symptom"><div className="t">Volume de vendas</div><div className="d">Dificuldade em crescer o número de veículos atendidos por mês.</div></div>
        <div className="pd-symptom"><div className="t">Margens apertadas</div><div className="d">Concorrência desleal e fuga de clientes para o e-commerce de peças.</div></div>
        <div className="pd-symptom"><div className="t">Rotatividade de equipe</div><div className="d">Alta troca de funcionários e dependência de poucas pessoas-chave.</div></div>
        <div className="pd-symptom"><div className="t">Ticket médio baixo</div><div className="d">Falta de processo para valorizar serviço e criar recorrência.</div></div>
      </div>
    </section>
  )
}
