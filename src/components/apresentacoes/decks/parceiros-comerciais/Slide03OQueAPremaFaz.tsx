export function Slide03OQueAPremaFaz() {
  return (
    <section className="pd-section">
      <p className="pd-eyebrow">O que a Prema faz</p>
      <h2 className="pd-title">Não é CRM. Não é disparador de mensagens em massa.</h2>
      <p className="pd-lede">
        É um motor de predição de manutenção personalizada por veículo, que converte histórico de OS em retorno
        automático pelo WhatsApp — funcionando enquanto a oficina trabalha.
      </p>

      <div className="pd-grid-4">
        <div className="pd-source-card"><span className="tag">FONTE 1</span><h5>Histórico de OS</h5><p>Serviços realizados, km e data, direto do ERP da oficina.</p></div>
        <div className="pd-source-card"><span className="tag">FONTE 2</span><h5>Perfil do cliente</h5><p>Uso severo, normal ou ocasional — o "Carlos trocador".</p></div>
        <div className="pd-source-card"><span className="tag">FONTE 3</span><h5>API de placa</h5><p>Specs do fabricante: modelo, motor, intervalos recomendados.</p></div>
        <div className="pd-source-card"><span className="tag">FONTE 4</span><h5>Conversa com o cliente</h5><p>Informações coletadas diretamente durante o atendimento.</p></div>
      </div>

      <div className="pd-wa-bubble">
        <div className="from">WhatsApp · Prema envia em nome da oficina</div>
        <p>"Seu Gol 1.0 está próximo do intervalo de troca recomendado pelo fabricante. Recomendamos agendar nos próximos 15 dias."</p>
      </div>
      <div className="pd-wa-reply"><p>"Obrigado por me avisar."</p></div>

      <div className="pd-takeaway">
        "A oficina não fez nada. A Prema fez." — a mensagem sai em nome da oficina; a reputação de quem lembra do
        cliente é sempre dela, nunca da Prema.
      </div>
    </section>
  )
}
