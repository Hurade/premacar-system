import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Check, BookOpen, Lightbulb, ShieldCheck, MessageSquare, Trophy, Handshake } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Block {
  title: string
  content: string
  tag?: string
}

function CopyBlock({ block }: { block: Block }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(block.content)
    setCopied(true)
    toast.success('Copiado!')
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="group relative bg-muted/10 border border-border/40 rounded-2xl p-4 hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{block.title}</p>
          {block.tag && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{block.tag}</span>
          )}
        </div>
        <button
          onClick={copy}
          className={cn(
            'p-2 rounded-lg transition-all flex-shrink-0',
            copied ? 'text-green-400 bg-green-500/10' : 'text-muted-foreground hover:text-primary hover:bg-primary/10',
          )}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{block.content}</p>
    </div>
  )
}

const SECTIONS = {
  dores: {
    icon: Lightbulb,
    label: 'Dores do Pós-Venda',
    blocks: [
      {
        title: 'O cliente que não volta',
        tag: 'Abertura',
        content: 'Você sabia que o custo de conquistar um novo cliente é 5 a 7 vezes maior que o de manter um existente? No mercado automotivo, o cliente visita o autocenter em média 2-3 vezes por ano — e quando ele some, a maior parte do faturamento vai junto.\n\nA pergunta é: dos clientes que atenderam sua oficina nos últimos 3 meses, quantos voltaram nos últimos 6?',
      },
      {
        title: 'O WhatsApp virou gargalo',
        tag: 'Problemas',
        content: 'Muitos donos de autocenter tentam usar o WhatsApp para manter contato com clientes. Mas o que acontece na prática:\n- 1 funcionário tenta mandar mensagem para 300 clientes por dia\n- As mensagens ficam genéricas e sem personalização\n- Não tem controle de quem respondeu, quem ignorou, quem está insatisfeito\n- O processo todo depende de uma pessoa só — e quando ela sai, some o contato com a base',
      },
      {
        title: 'A base parada é dinheiro na mesa',
        tag: 'Urgência',
        content: 'Estamos falando de clientes que já conhecem você, já confiam em você, já gastaram dinheiro com você.\n\nSe você tem 3.000 clientes na base e só 20% voltam todo mês, são 2.400 clientes que poderiam estar gerando receita agora mesmo — e você não sabe nem por que foram embora.',
      },
      {
        title: 'Reclamação que você não sabe',
        tag: 'NPS',
        content: 'Você sabia que apenas 4% dos clientes insatisfeitos reclamam diretamente? Os outros 96% simplesmente não voltam — e ainda falam mal para outras pessoas.\n\nCada cliente insatisfeito conta para uma média de 9 a 15 outras pessoas. Se você não mede satisfação, está operando no escuro.',
      },
    ] as Block[],
  },
  beneficios_nps: {
    icon: ShieldCheck,
    label: 'Benefícios do NPS',
    blocks: [
      {
        title: 'NPS na prática para o autocenter',
        tag: 'Educativo',
        content: 'NPS (Net Promoter Score) é a métrica que as maiores empresas do mundo usam para saber se estão agradando seus clientes.\n\nFunciona assim: logo após o atendimento, o cliente recebe uma pergunta simples pelo WhatsApp:\n"De 0 a 10, qual a chance de você recomendar nossa oficina para um amigo?"\n\nQuem responde 9-10: promotor (fã da marca)\nQuem responde 7-8: passivo (satisfeito, mas pode ir para a concorrência)\nQuem responde 0-6: detrator (vai falar mal, provavelmente)\n\nCom esse dado, você sabe exatamente onde agir.',
      },
      {
        title: 'O que o NPS resolve no dia a dia',
        tag: 'Benefícios',
        content: '✅ Identifica problemas antes que virem reviews no Google\n✅ Transforma detratores em promotores (com ação rápida)\n✅ Gera prova social real — você pode mostrar sua nota NPS para novos clientes\n✅ Motiva a equipe quando a nota sobe\n✅ Ajuda a entender quais serviços geram mais ou menos satisfação\n✅ Diferencial competitivo — poucos autocenters medem isso',
      },
      {
        title: 'Retorno esperado com NPS',
        tag: 'ROI',
        content: 'Um autocenter com NPS acima de 60 tende a:\n- Crescer 2x mais rápido que a média do mercado\n- Ter 30% mais indicações orgânicas de clientes\n- Reduzir em 20% a perda de clientes por insatisfação silenciosa\n\nE o melhor: quando você detecta um problema e resolve rápido, o cliente que quase ia embora se torna um dos mais fiéis.',
      },
    ] as Block[],
  },
  lembretes: {
    icon: BookOpen,
    label: 'Lembretes Automáticos',
    blocks: [
      {
        title: 'Por que lembretes automáticos funcionam',
        tag: 'Conceito',
        content: 'O cliente não esquece da sua oficina porque não gosta — ele esquece porque a vida é corrida.\n\nUm lembrete bem-feito, no momento certo, faz com que você apareça na hora que o cliente está pensando em levar o carro. E aí é você que ganha a revisão, não a concorrência.',
      },
      {
        title: 'Exemplo de mensagem de lembrete',
        tag: 'Modelo',
        content: 'Oi João! 👋 Aqui é o Auto Center Silva.\n\nEstamos ligando pra te lembrar que já faz 3 meses desde a sua última revisão. O seu veículo pode estar precisando de verificação de óleo, freios e filtros.\n\nQuer agendar um check-up rápido esta semana? Temos horários disponíveis na quarta e na quinta. 😊',
      },
      {
        title: 'Impacto nos números',
        tag: 'ROI',
        content: 'Autocenters que implementam lembretes automáticos relatam:\n\n📈 +25% a +40% de aumento na taxa de retorno\n📉 -60% de tempo gasto pela equipe com ligações manuais\n🎯 3x mais agendamentos via WhatsApp vs. ligação fria\n\nO melhor: a Prema Car faz tudo isso de forma automática, personalizada e escalável.',
      },
    ] as Block[],
  },
  recuperacao: {
    icon: Trophy,
    label: 'Recuperação de Clientes',
    blocks: [
      {
        title: 'Quanto vale um cliente inativo',
        tag: 'Valor',
        content: 'Um cliente típico de autocenter visita o estabelecimento 2-3 vezes por ano, com ticket médio de R$350 por visita.\n\nSão R$700 a R$1.050 por cliente, por ano.\n\nSe você tem 500 inativos e recupera apenas 10%, são 50 clientes × R$850 médio = R$42.500 em faturamento adicional.\n\nQuantas horas de trabalho valem 10% de recuperação na sua base?',
      },
      {
        title: 'Fluxo de recuperação que funciona',
        tag: 'Processo',
        content: 'Dia 1 — Mensagem de reativação personalizada:\n"Oi Carlos! Faz um tempinho que você não vem aqui na oficina. Tudo bem? Seu carro está rodando direitinho?"\n\nDia 3 — Follow-up com oferta:\n"Carlos, te mandei mensagem há 3 dias e queria saber se ficou com alguma dúvida. Temos uma condição especial para clientes antigos essa semana 🙂"\n\nDia 7 — Última tentativa:\n"Vamos deixar a porta aberta, Carlos. Quando precisar de algum serviço no carro, estaremos aqui!"',
      },
      {
        title: 'Por que a IA funciona melhor',
        tag: 'Diferencial',
        content: 'Com a IA Cris da Prema Car, a conversa de recuperação é:\n\n🤖 Personalizada — usa o nome, o histórico, o carro\n⚡ Escalável — conversa com 500 clientes ao mesmo tempo\n⏰ Disponível — 24/7, sem depender de equipe\n📊 Mensurável — você vê cada resposta, cada conversão\n🔄 Consistente — nunca sai do script ideal',
      },
    ] as Block[],
  },
  fidelizacao: {
    icon: Handshake,
    label: 'Fidelização',
    blocks: [
      {
        title: 'Fidelização vs. Conquista',
        tag: 'Conceito',
        content: 'Conquistar um cliente novo custa 5-7x mais que manter um existente. Para o autocenter, isso é ainda mais crítico:\n\n- Marketing para atrair: panfletos, redes, indicações\n- Tempo de convencer: o cliente novo ainda não confia\n- Risco: ele pode ir à concorrência depois\n\nO cliente fiel já confia, já sabe a qualidade, e tende a gastar mais com o tempo.',
      },
      {
        title: 'Programa de pontos simplificado',
        tag: 'Estratégia',
        content: 'Você não precisa de um app caro para ter um programa de fidelidade.\n\nUma régua simples funciona:\n✅ 1ª revisão: obrigado + pesquisa de satisfação\n✅ 2ª visita: lembrete + benefício exclusivo\n✅ 3ª visita: reconhecimento + upgrade ou brinde\n✅ Cliente "VIP": atendimento preferencial + divulgação\n\nA Prema Car automatiza essa régua inteira via WhatsApp.',
      },
      {
        title: 'O que um cliente fiel gera',
        tag: 'ROI',
        content: '💰 Gasta em média 67% mais que um cliente novo\n👥 Indica em média 3 novas pessoas por ano\n⭐ Tende a dar avaliações positivas no Google\n🛡️ É mais tolerante a pequenos erros\n📱 Responde às comunicações com 3x mais frequência\n\nFidelizar não é custo — é o investimento com maior retorno do mercado automotivo.',
      },
    ] as Block[],
  },
  objecoes: {
    icon: MessageSquare,
    label: 'Objeções e Respostas',
    blocks: [
      {
        title: '"Está caro pra mim agora"',
        tag: 'Preço',
        content: 'Entendo perfeitamente. Mas vamos pensar juntos:\n\nSe você tem 1.000 clientes na base e recuperar 5% deles gera em média R$350 por visita, isso são 50 clientes × R$350 = R$17.500 de faturamento adicional.\n\nO investimento no plano é R$997/mês. Em 1 mês você já paga e ainda sobra R$16.503.\n\nA pergunta não é se é caro — a pergunta é: quanto você está deixando de faturar por não ter isso rodando hoje?',
      },
      {
        title: '"Não é o momento certo"',
        tag: 'Timing',
        content: 'Entendo. Curiosidade: quando seria o momento certo para você? Quando tiver mais clientes na base? Quando a operação estiver maior?\n\nO problema é que sem um processo de pós-venda, fica muito difícil crescer. É um círculo: a base não cresce porque o cliente não volta; o cliente não volta porque não tem pós-venda.\n\nA Prema Car quebra esse ciclo. E quanto antes começa, mais rápido você vê resultado.',
      },
      {
        title: '"Já tentamos e não funcionou"',
        tag: 'Experiência',
        content: 'O que aconteceu antes? Se você me contar um pouco, consigo te dizer o que foi diferente no caso deles.\n\nNa maioria das vezes, o que não funciona é:\n- WhatsApp manual (não escala)\n- Mensagens genéricas (sem personalização)\n- Falta de follow-up (uma tentativa e desiste)\n- Sem medição (não sabe o que funciona)\n\nA Prema Car resolve todos esses pontos. É por isso que os resultados são diferentes.',
      },
      {
        title: '"Preciso pensar"',
        tag: 'Fechamento',
        content: 'Claro, faz todo sentido pensar. Me fala: o que ainda não ficou claro na proposta? Tem alguma parte que não faz sentido para o seu cenário?\n\nQuero garantir que a decisão seja tomada com todas as informações. E se você decidir seguir em frente agora, ainda conseguimos manter a condição especial que coloquei na proposta.',
      },
      {
        title: '"Preciso falar com meu sócio"',
        tag: 'Stakeholder',
        content: 'Com certeza! Quanto tempo você precisa para conversar com ele? Posso enviar um resumo da proposta por e-mail para facilitar a apresentação?\n\nAlternativamente, posso fazer uma call rápida com vocês dois juntos — 20 minutos são suficientes para tirar todas as dúvidas. O que funciona melhor?',
      },
    ] as Block[],
  },
  fechamento: {
    icon: Check,
    label: 'Textos de Fechamento',
    blocks: [
      {
        title: 'Fechamento por urgência real',
        tag: 'Urgência',
        content: 'Quero ser honesto com você: a condição que coloquei na proposta — [condição especial] — é válida até [data]. Não é pressão, é porque temos uma agenda de onboarding e precisamos organizar as datas.\n\nSe você fechar até [data], garantimos [benefício]. Se precisar de mais tempo, tudo bem, mas o preço pode mudar.\n\nO que você precisa para decidir hoje?',
      },
      {
        title: 'Fechamento consultivo',
        tag: 'Consultivo',
        content: 'Olhando tudo que conversamos, acredito muito que a Prema Car vai transformar o pós-venda de vocês.\n\nVocês têm os elementos certos: uma base de clientes boa, uma operação funcionando, e uma dor clara que eu consigo resolver.\n\nEu prefiro um "não" sincero a um "talvez" eterno. O que você precisa para me dar uma resposta essa semana?',
      },
      {
        title: 'Fechamento após silêncio',
        tag: 'Follow-up',
        content: 'Oi [nome]! Estou encerrando minha agenda dessa semana e queria dar um retorno.\n\nA proposta para [empresa] fica válida até [data]. Se não for o momento certo, sem problema — podemos conversar lá na frente.\n\nMas se ainda estiver considerando, esse é o melhor momento para garantir a condição atual. Me dá uma palavra? 🙂',
      },
    ] as Block[],
  },
}

type SectionKey = keyof typeof SECTIONS

export default function Biblioteca() {
  const navigate = useNavigate()

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/propostas')} className="p-2 rounded-xl hover:bg-muted/50">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Biblioteca Comercial</h1>
            <p className="text-sm text-muted-foreground">Blocos de conteúdo prontos para usar nas negociações</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/15 rounded-xl">
          <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Clique em <Copy className="w-3 h-3 inline mx-1" /> para copiar qualquer bloco e usar no WhatsApp, e-mail ou apresentação.
          </p>
        </div>

        <Tabs defaultValue="dores" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/20 p-1 mb-2">
            {(Object.keys(SECTIONS) as SectionKey[]).map(key => {
              const section = SECTIONS[key]
              const Icon = section.icon
              return (
                <TabsTrigger
                  key={key}
                  value={key}
                  className="gap-1.5 text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {section.label}
                </TabsTrigger>
              )
            })}
          </TabsList>

          {(Object.keys(SECTIONS) as SectionKey[]).map(key => (
            <TabsContent key={key} value={key} className="space-y-3 mt-4">
              <div className="flex items-center gap-2 mb-2">
                {(() => { const Icon = SECTIONS[key].icon; return <Icon className="w-4.5 w-[18px] h-[18px] text-primary" /> })()}
                <h2 className="text-sm font-semibold text-foreground">{SECTIONS[key].label}</h2>
                <span className="text-xs text-muted-foreground">({SECTIONS[key].blocks.length} blocos)</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {SECTIONS[key].blocks.map(block => (
                  <CopyBlock key={block.title} block={block} />
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
