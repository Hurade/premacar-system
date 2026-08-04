import type { AtuacaoPrincipal } from '@/types/apresentacoes'

export interface VerticalContent {
  label: string
  painCards: { title: string; desc: string }[]
  triggerLabel: string
  exampleVehicle: string
  exampleMessage: string
  cycleStages: { day: string; title: string; desc: string }[]
  recoveryQuestion: string
}

/** Conteúdo específico por atuação — extraído fielmente dos decks de referência
 * "PremaCar Troca de Óleo" e "PremaCar Pneus". 'mecanica_geral' e 'outro' usam
 * uma versão mais genérica (GENERICO), sem gatilho/exemplo específico de peça. */
export const VERTICAL_CONTENT: Record<AtuacaoPrincipal, VerticalContent> = {
  oleo: {
    label: 'troca de óleo',
    painCards: [
      { title: 'Giro de Equipe', desc: 'Falhas na memória humana e dependência total de funcionários — vulnerável à alta rotatividade.' },
      { title: 'Falta de Dados', desc: 'Impossibilidade de rastrear exatamente quem leu, quem agendou e quanto isso gerou em caixa.' },
      { title: 'Teto de Crescimento', desc: 'Processo não escalável. À medida que o volume (VAT) cresce, o controle se perde.' },
    ],
    triggerLabel: '6 meses',
    exampleVehicle: 'Gol 1.0',
    exampleMessage: 'Olá Leonardo, faz 6 meses que o seu Gol 1.0 trocou o óleo conosco. Vamos agendar a revisão para manter o motor seguro?',
    cycleStages: [
      { day: 'Dia 0', title: 'O.S. Fechada no Sistema', desc: 'Prema calcula o retorno pelo tipo de serviço/produto e assume o disparo.' },
      { day: 'Mês 6', title: 'Mensagem Padrão de Troca', desc: 'Aviso automático de que o intervalo recomendado está chegando.' },
      { day: 'Mês 7', title: 'Aviso de Vencimento Crítico', desc: 'Se ignorado, a engrenagem continua girando — segundo aviso, mais direto.' },
      { day: 'Mês 8', title: 'Oferta Agressiva de Resgate', desc: 'Desconto ou bônus extra ativado automaticamente para reconquistar o cliente.' },
    ],
    recoveryQuestion: 'O cliente ignorou o aviso de troca de óleo?',
  },
  pneus: {
    label: 'pneus',
    painCards: [
      { title: 'Margens Apertadas', desc: 'Alta concorrência e dependência de vendas pontuais.' },
      { title: 'Esforço Manual', desc: 'A equipe esquece de ligar para o cliente voltar para o rodízio.' },
      { title: 'Perda de Oportunidade', desc: 'Serviços recorrentes são feitos na concorrência porque o cliente não foi lembrado.' },
    ],
    triggerLabel: '10.000 km ou 3 meses',
    exampleVehicle: 'Corolla',
    exampleMessage: 'Olá Leonardo, seu Corolla está próximo dos 10.000 km desde o último rodízio. Vamos agendar o alinhamento?',
    cycleStages: [
      { day: 'Dia 0', title: 'Traqueamento de Leads', desc: 'O cliente realiza o serviço. O sistema absorve os dados sem intervenção humana.' },
      { day: 'Dia 3', title: 'NPS Automático', desc: 'Pesquisa de satisfação enviada. Clientes satisfeitos são direcionados para o Google.' },
      { day: 'Dia 80', title: 'Cashback & Bônus', desc: 'Lembrete automático com saldo disponível para o serviço de 3 meses.' },
      { day: 'Dia 90', title: 'Rodízio e Alinhamento', desc: 'O cliente retorna. O ciclo se reinicia.' },
    ],
    recoveryQuestion: 'O cliente ignorou o aviso de rodízio?',
  },
  mecanica_geral: {
    label: 'mecânica geral',
    painCards: [
      { title: 'Giro de Equipe', desc: 'Falhas na memória humana e dependência total de funcionários — vulnerável à alta rotatividade.' },
      { title: 'Falta de Dados', desc: 'Impossibilidade de rastrear exatamente quem leu, quem agendou e quanto isso gerou em caixa.' },
      { title: 'Teto de Crescimento', desc: 'Processo não escalável. À medida que o volume (VAT) cresce, o controle se perde.' },
    ],
    triggerLabel: 'o intervalo recomendado do serviço',
    exampleVehicle: 'carro',
    exampleMessage: 'Olá Leonardo, está chegando a data da revisão do seu carro. Vamos agendar o próximo serviço?',
    cycleStages: [
      { day: 'Dia 0', title: 'O.S. Fechada no Sistema', desc: 'Prema calcula o retorno pelo tipo de serviço e assume o disparo.' },
      { day: 'Ciclo', title: 'Aviso Automático', desc: 'Mensagem disparada no intervalo recomendado para cada tipo de serviço.' },
      { day: 'Vencido', title: 'Aviso de Vencimento Crítico', desc: 'Se ignorado, segundo aviso mais direto entra em ação.' },
      { day: 'Resgate', title: 'Oferta de Resgate', desc: 'Bônus ativado automaticamente para reconquistar o cliente.' },
    ],
    recoveryQuestion: 'O cliente ignorou o aviso de retorno?',
  },
  outro: {
    label: 'pós-venda',
    painCards: [
      { title: 'Giro de Equipe', desc: 'Falhas na memória humana e dependência total de funcionários — vulnerável à alta rotatividade.' },
      { title: 'Falta de Dados', desc: 'Impossibilidade de rastrear exatamente quem leu, quem agendou e quanto isso gerou em caixa.' },
      { title: 'Teto de Crescimento', desc: 'Processo não escalável. À medida que o volume (VAT) cresce, o controle se perde.' },
    ],
    triggerLabel: 'o intervalo recomendado do serviço',
    exampleVehicle: 'carro',
    exampleMessage: 'Olá Leonardo, está chegando a data da revisão do seu carro. Vamos agendar o próximo serviço?',
    cycleStages: [
      { day: 'Dia 0', title: 'O.S. Fechada no Sistema', desc: 'Prema calcula o retorno pelo tipo de serviço e assume o disparo.' },
      { day: 'Ciclo', title: 'Aviso Automático', desc: 'Mensagem disparada no intervalo recomendado para cada tipo de serviço.' },
      { day: 'Vencido', title: 'Aviso de Vencimento Crítico', desc: 'Se ignorado, segundo aviso mais direto entra em ação.' },
      { day: 'Resgate', title: 'Oferta de Resgate', desc: 'Bônus ativado automaticamente para reconquistar o cliente.' },
    ],
    recoveryQuestion: 'O cliente ignorou o aviso de retorno?',
  },
}
