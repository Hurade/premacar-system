export function Slide06PerfilDePublico() {
  return (
    <section className="pd-section">
      <p className="pd-eyebrow">Perfil de público-alvo</p>
      <h2 className="pd-title">Quem procurar na sua base ou rede de relacionamento.</h2>
      <p className="pd-lede">
        Use este perfil como filtro antes de indicar — é ele que separa uma indicação que fecha rápido de uma que
        não avança.
      </p>

      <div className="pd-grid-4">
        <div className="pd-icp-card"><div className="k">Atuação</div><div className="v">Oficina mecânica / Auto center</div></div>
        <div className="pd-icp-card"><div className="k">Volume</div><div className="v">&gt; 100 veículos atendidos/mês (VATs)</div></div>
        <div className="pd-icp-card"><div className="k">Porte</div><div className="v">1 unidade com 300+ clientes ativos, ou 2+ unidades</div></div>
        <div className="pd-icp-card"><div className="k">Maturidade</div><div className="v">Já tenta manter relacionamento com o cliente de alguma forma</div></div>
      </div>

      <div className="pd-grid-2-eq" style={{ marginTop: 20 }}>
        <div className="pd-icp-panel">
          <h5>Decisores-alvo</h5>
          <ul>
            <li>Proprietário(a) da oficina</li>
            <li>Gestor(a) / gerente da unidade</li>
            <li>Gerente de marketing (redes maiores)</li>
          </ul>
        </div>

        <div className="pd-icp-panel pd-signal">
          <h5>Sinal de que é a hora certa</h5>
          <div className="quote">"Sei que tenho cliente que não vejo há 1 ano e nunca entrei em contato."</div>
          <ul>
            <li>Reclama de agenda imprevisível (segunda e sexta vazias)</li>
            <li>Já tentou ligar para inativos e desistiu</li>
            <li>Não sabe quantos clientes "sumiram" nem por quê</li>
          </ul>
        </div>
      </div>

      <div className="pd-icp-panel pd-anti" style={{ marginTop: 14 }}>
        <h5>Quando não indicar agora</h5>
        <ul>
          <li>Não usa ERP ou não registra km nas OS</li>
          <li>Base pequena — menos de 200 clientes ativos</li>
          <li>Concessionária (porte e processo diferentes)</li>
          <li>Quer "disparar para todo mundo" sem critério</li>
        </ul>
      </div>

      <div className="pd-takeaway">
        Jornada de decisão típica: 14 a 45 dias do primeiro contato ao pagamento — e a validação social de um
        colega ou parceiro de confiança é o que mais acelera esse ciclo.
      </div>
    </section>
  )
}
