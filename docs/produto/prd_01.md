---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments:
  - '_bmad-output/planning-artifacts/product-brief-Code-guardian-2026-02-26.md'
  - '_bmad-output/planning-artifacts/research/market-prema-automotivo-research-2026-02-26.md'
  - '_bmad-output/brainstorming/brainstorming-s0-sintese-geral.md'
  - '_bmad-output/brainstorming/brainstorming-s1-produto-ia.md'
  - '_bmad-output/brainstorming/brainstorming-s2-engajamento-b2c.md'
  - '_bmad-output/brainstorming/brainstorming-s3-reativacao-inativos.md'
  - '_bmad-output/brainstorming/brainstorming-s4-comercial-marketing.md'
  - 'docs/FUNCIONALIDADES que a Prema já tem.md'
workflowType: 'prd'
briefCount: 1
researchCount: 1
brainstormingCount: 5
projectDocsCount: 1
classification:
  projectType: saas_b2b
  domain: general
  domainVertical: automotive_services
  complexity: medium
  projectContext: hybrid
  hybridNote: 'Produto em produção com 170+ Robertos pagantes, NPS 90, benchmark Fev/26 real. PRD foca na evolução P0-P5 sobre o baseline existente. Não é greenfield (tem código e clientes) nem brownfield clássico (é produto jovem sendo ampliado).'
---

# Product Requirements Document - Code-guardian

**Author:** Petersonkolling
**Date:** 2026-03-02

## Executive Summary

A Prema é uma plataforma SaaS B2B que automatiza a recorrência de clientes em oficinas mecânicas pelo WhatsApp — transformando o histórico de ordens de serviço do ERP em ações automáticas de retorno, calculadas individualmente por veículo, sem intervenção manual da equipe após o setup inicial.

**Usuários-alvo (atual):** Donos de oficinas mecânicas independentes (1 loja, 200–1.500 clientes ativos) que não têm tempo, critério ou processo para contatar clientes inativos de forma sistemática.
**Usuários-alvo (roadmap):** Gestores de redes de autocenters (8–30 unidades) que perderam visibilidade do comportamento da base inteira em escala.

**Problema resolvido:** O ERP registra o passado — quem veio, o que fez, quando. Mas não converte esse histórico em ação futura. Roberto não sabe quem está próximo do ciclo de troca, não tem critério para "inativo", não sabe o que escrever sem parecer insistente, e se acostumou com a perda invisível: nada explode, nada dói, o caixa gira — mas clientes evaporam em silêncio. Para redes de 10 lojas, 400 clientes perdidos/mês a ticket médio de R$800 representam R$320k que aparecem no P&L como "esse mês foi fraco". O problema não é falta de vontade de ligar. É a inexistência de um sistema que converta dados passados em ações automáticas futuras.

**Estado atual:** Produto em produção com 170+ Robertos pagantes (R$650/Roberto MRR). Benchmark Fev/26: 14.500 mensagens enviadas → 1.992 retornos (13,7%) → R$1.566.273,58 em faturamento gerado para a base. NPS médio das oficinas clientes, medido pelo módulo de pesquisa da Prema: 90. Taxa de resposta às pesquisas: 35,78%. O PRD define a evolução P0–P5 sobre esse baseline — não é greenfield.

### What Makes This Special

**O insight central:** A Prema não é CRM, não é marketing e não é disparador de mensagens. É um motor de predição de manutenção personalizada por veículo que converte histórico de OS em retorno automático pelo WhatsApp. Funciona enquanto Roberto trabalha.

**O momento de encantamento:** Carlos recebe: *"Seu Gol 1.0 está próximo do intervalo de troca recomendado pelo fabricante para o seu perfil de uso. Recomendamos agendar nos próximos 15 dias."* Ele retorna e agradece: *"Obrigado por me avisar."* Roberto não fez nada. A Prema fez. A reputação é dele.

**Diferenciador técnico — Motor de Predição Personalizada:** A Prema calcula o momento ideal de retorno de cada veículo cruzando quatro fontes de dados:
1. Histórico de OS do ERP (serviços realizados, km, data)
2. Perfil do cliente (uso Severo/Normal/Ocasional — "Carlos Trocador")
3. API de placa (specs do fabricante: modelo, motor, capacidade, intervalos recomendados de manutenção)
4. Informações coletadas diretamente do cliente durante o atendimento

O resultado é uma previsão de retorno individual por veículo — não um intervalo genérico de tempo.

**Diferenciador operacional — Modelo Opt-Out:** Após setup inicial (integração ERP, configuração de templates WABA, definição de perfis de uso), o sistema opera autonomamente. Roberto não cria campanhas, não segmenta listas, não aperta botões. A inércia que antes era inimiga da retenção passa a trabalhar a favor do faturamento.

**Diferenciador de prova de ROI — Funil de Atribuição:** A perda invisível exige prova visível. A Prema rastreia cada cliente do primeiro toque até o pagamento:

> Enviada → Visualizada → Respondeu → Agendou → Apareceu → Pagou

Roberto vê exatamente quantos retornos, quanto faturamento e qual Lucro Bruto a Prema gerou — por serviço, por período, por cliente.

**Diferenciador de identidade:** WhatsApp como chave primária (não CPF, não veículo). Pessoa = identidade permanente. Veículo = atributo mutável. Elimina duplicações e garante rastreabilidade mesmo quando Carlos troca de carro.

**Evolução para redes (roadmap):** Para gestores de redes com 8–30 unidades, a Prema evolui para painel único de governança: inativos por unidade, receita projetada por manutenção futura, padronização de comunicação entre lojas — transformando vazamento silencioso em inteligência de negócio previsível.

**Por que agora:** WhatsApp API oficial (WABA). IA acessível. API de placa disponível e barata. Consumidor aceita o lembrete inteligente. CAC de tráfego pago tornou retenção questão de sobrevivência. Mercado automotivo ainda atrasado — gap = oportunidade de dominância de base.

## Contexto do Produto

| Atributo      | Valor                                            |
|---------------|--------------------------------------------------|
| Tipo          | SaaS B2B                                         |
| Domínio       | Serviços Automotivos                             |
| Complexidade  | Média                                            |
| Contexto      | Híbrido (produto em produção sendo escalado)     |
| Canal         | WhatsApp-first (WABA + ApiDoZap)                 |
| Modelo        | Motor de predição de manutenção personalizada    |
| Baseline      | 170+ Robertos, NPS 90 oficinas, benchmark Fev/26 |
| Escopo PRD    | Evolução P0–P5 sobre baseline existente          |

## Success Criteria

### Product Impact Metrics

Métricas que medem o valor gerado pelo produto para Robertos e Carloses.

| Métrica                              | Baseline Mar/26 | Meta Dez/26     |
|--------------------------------------|-----------------|-----------------|
| Taxa de retorno de Carloses          | 13,7%           | ≥ 20%           |
| Taxa de engajamento (leitura + resp) | a mapear em P1  | ≥ 25%           |
| Conversão em serviço pago            | a mapear em P1  | a definir       |
| Ticket médio do retorno atribuído    | a mapear em P1  | a definir       |
| Robertos com funil ativo (P1+)       | 0%              | 100%            |

> **Nota:** Engajamento (leu + respondeu) ≠ Retorno pago. São etapas distintas do funil e não podem ser usadas de forma intercambiável como sucesso.

### Company Growth Metrics

Métricas que medem a saúde e crescimento do negócio Prema.

| Métrica                | Baseline Mar/26 | Meta Dez/26     |
|------------------------|-----------------|-----------------|
| Robertos pagantes      | 170+            | 308             |
| MRR                    | R$47k           | R$200k          |
| Churn mensal           | 10%             | ≤ 3%            |
| Ticket médio (novos)   | R$650           | R$650+          |
| Ticket médio (base)    | ~R$276          | crescimento gradual |

### North Star

**Primária — Receita Atribuída via Funil Validado:**
> Soma do faturamento de todos os Carloses que completaram o funil (Enviada → Pagou) em um período, calculado sobre as margens reais do serviço.

Roberto configura as margens padrão ao ativar a conta:

| Categoria   | Margem Padrão | Ajustável |
|-------------|---------------|-----------|
| Mão de obra | 100%          | Sim       |
| Peças       | 50%           | Sim       |
| Pneus       | 15%           | Sim       |

Enquanto Roberto não configurar as margens, a plataforma usa os padrões do setor. A North Star primária requer funil ativo (P1+).

**Secundária — Lucro Bruto Estimado:**
> Receita atribuída × margem configurada. Disponível quando Roberto inseriu margens. Marcado claramente como "estimado" para evitar conflito com dados contábeis reais.

### Risk Taxonomy

**Risco Existencial** — se ocorrer, compromete o produto:

| Risco               | Detalhe                                                                                                        | Mitigação                                                              |
|---------------------|----------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| Ban WABA            | API oficial: entrega ≥ 95%, custo Meta visível ao Roberto. API não-oficial: entrega < 75%, desconexão frequente | Fila randomizada anti-spam; migração gradual para oficial; transparência de custo Meta por Roberto |
| ERP desconectado    | Dados parados > 48h sem integração ativa                                                                       | ≥ 3 fontes alternativas: CSV e-mail, importação manual, API direta     |
| Canal falho (Carlos)| WhatsApp incorreto ou Carlos sem WhatsApp                                                                      | Email como canal paralelo simultâneo ao WhatsApp                       |

**Risco de Performance** — se ocorrer, degrada o produto:

| Risco                 | Threshold          | Ação                                              |
|-----------------------|--------------------|---------------------------------------------------|
| Engajamento < 25%     | mensagens ignoradas | Revisar conteúdo, timing, personalização         |
| API de placa < 95%    | predição degradada  | Fallback para intervalo genérico temporário      |

### Measurable Outcomes

1. Churn mensal: 10% → ≤ 3% até Dez/2026
2. Taxa de retorno Carloses: 13,7% → ≥ 20% até Dez/2026
3. Crescimento: 170 → 308 Robertos até Dez/2026
4. MRR: R$47k → R$200k até Dez/2026
5. Funil de atribuição: 100% dos Robertos ativos com visibilidade completa após P1
6. North Star primária estabelecida e monitorada a partir de P1

## Product Scope

### MVP — Já em Produção (baseline)

- Envio automático de mensagens WhatsApp (lembretes de óleo, pneu, balanceamento, aniversário, NPS)
- Pesquisa NPS automática com dashboard de resultados
- Campanhas manuais com templates WABA
- Gestão de clientes com opt-out e histórico de serviços
- Gestão de equipe (mecânicos/recepcionistas)
- Dashboards de desempenho (NPS, retorno, mensagens)
- Integrações: ZPro CRM, ApiDoZap, Alvescar, e-mail CSV/XLSX, RedMinds HelpDesk, OpenAI/GPT

### Growth — Escopo deste PRD (P0–P3)

**P0 — Quick Win:**
- Melhora do funil de recuperação existente com dados de ciclo real
- Aumento de engajamento das mensagens já enviadas
- Não envio em feriados nacionais e estaduais

**P1 — Funil de Atribuição + North Star:**
- Rastreamento completo: Enviada → Visualizada → Respondeu → Agendou → Apareceu → Pagou
- Dashboard de Receita Atribuída e Lucro Bruto estimado
- Configuração de margens por categoria (MO/Peças/Pneus)
- Controle de créditos de campanha

**P2 — Motor de Predição Personalizada:**
- Integração com API de placa
- Classificação de perfil de uso (Severo/Normal/Ocasional)
- Cálculo individual de ciclo de retorno por veículo
- Email como canal paralelo ao WhatsApp para Carlos

**P3 — Opt-Out Inteligente + Relatórios Automáticos:**
- Carlos gerencia preferências sem atrito
- Relatórios semanais e mensais automáticos (WhatsApp + e-mail)
- Fila randomizada anti-spam com crescimento gradual de velocidade

### Vision — Futuro (P4–P5+)

**P4 — Free Bet:**
- 40 reativações gratuitas para novos Robertos (prova de valor antes da assinatura)

**P5 — AI-First Attendant:**
- IA conduz conversa com Carlos end-to-end
- Não apenas dispara — responde, esclarece, agenda

**Multi-loja:**
- Painel único de governança para redes de 8–30 unidades
- Receita projetada por manutenção futura por unidade

### Strategic Non-Goals

O que a Prema deliberadamente **não vai construir**:
- Gestão financeira da oficina
- ERP próprio
- Marketplace de peças

## Assumptions & Constraints

### Assumptions

1. WhatsApp continuará dominante como canal de comunicação no Brasil
2. Taxa de engajamento ≥ 25% é sustentável com mensagens personalizadas por veículo
3. ERP continuará a principal fonte de dados operacionais por Roberto

### Constraints

| Restrição          | Detalhe                                                              |
|--------------------|----------------------------------------------------------------------|
| WABA / Meta        | Sujeito a políticas, custos e mudanças unilaterais da Meta           |
| LGPD               | Dados de clientes exigem consentimento explícito e opt-out ativo     |
| API de placa       | Dependência de fornecedor externo; cobertura e uptime não garantidos |
| Integração ERP     | Sem padrão único entre fornecedores; variabilidade de implementação  |

## User Journeys

### Mapa de Personas

| Persona                    | Tipo           | Escopo PRD | Prioridade |
|----------------------------|----------------|------------|------------|
| Roberto Owner/Single       | Primário       | P0–P3      | Crítica    |
| Roberto Owner/Multi        | Primário       | Roadmap    | Alta       |
| Roberto Regional           | Primário       | Roadmap    | Média      |
| Gerente de Unidade         | Operacional    | Roadmap    | Média      |
| Atendente/Vendedor         | Operacional    | P1         | Crítica    |
| Carlos "Responde e Agenda" | End-user       | P0–P2      | Crítica    |
| Carlos "Ignora"            | End-user       | P0–P2      | Alta       |
| Carlos "Bloqueia/Spam"     | End-user       | P0         | Crítica    |
| Carlos Frota/Empresa       | End-user B2B   | P2         | Média      |
| Carlos Baixa Literacia     | End-user       | P1         | Média      |
| Integrador ERP/TI          | Habilitador    | P0         | Crítica    |
| Equipe Prema Ops/CS        | Admin          | P0         | Crítica    |
| Roberto Influenciador      | Crescimento    | P2         | Média      |
| Carlos Promotor            | Crescimento    | P2         | Baixa      |
| Fornecedor/Distribuidor    | Estratégico    | P4+        | Baixa      |

---

### Framework de Métricas por Jornada

| Campo                | Definição                                                  |
|----------------------|------------------------------------------------------------|
| Evento inicial       | O que dispara esta jornada                                 |
| Objetivo             | Resultado esperado ao final                                |
| Métrica de sucesso   | Número claro e mensurável                                  |
| Threshold de falha   | Quando considerar a jornada como falha                     |
| Intervenção          | Ação automática ou humana ao cruzar threshold              |
| North Star impactada | Qual métrica North Star esta jornada move                  |
| Impacto              | LTV / Retenção / NRR / CAC afetado                         |

---

### Jornada 0 — Roberto: Descoberta & Decisão (Pré-Compra)

**Persona:** Roberto Carvalho sente que clientes "evaporam" mas nunca mediu. Já tentou 3 ferramentas antes. Chegou à Prema por indicação de um colega.

**Cena:** Roberto está no celular às 21h depois de fechar o caixa. Acessa o site pela primeira vez. Tem 5 minutos de paciência.

**Jornada:** Landing page mostra calculadora: "Quantos clientes você tem no ERP?" Roberto digita 847. "Em média, 62% estão inativos há mais de 6 meses — isso representa R$XX em receita mensal não recuperada." Roberto pensa: "é verdade." Clica em conectar ERP. Onboarding guiado: 3 passos, 12 minutos, sem cartão de crédito.

**Clímax:** Em ≤ 10 min Roberto vê: "524 clientes inativos. 47 entram em janela de retorno essa semana. Receita potencial: R$21.000." Esse é o Momento Aha.

**Resolução:** Roberto ativa o trial. A jornada de sucesso começa.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | Primeiro acesso ao produto (trial / demo)                          |
| Objetivo             | ERP conectado + Aha em ≤ 10 min                                   |
| Métrica de sucesso   | Tempo até Aha ≤ 10 min; ERP conectado na primeira sessão           |
| Threshold de falha   | Abandona antes de conectar ERP                                     |
| Intervenção          | Calculadora de receita na tela inicial; onboarding guiado 3 passos |
| North Star impactada | MRR (aquisição); Ativação                                          |
| Impacto              | CAC; taxa de conversão trial → pago                                |

---

### Jornada 1 — Roberto Owner/Single: Sucesso (Happy Path)

**Persona:** Roberto Carvalho, 42 anos. 847 clientes no ERP, 127 ativos nos últimos 3 meses. Fecha o caixa toda sexta perguntando "onde foram os outros?"

**Cena:** Trial ativo. ERP conectado. Histórico importado. Margens configuradas (MO 100%, Peças 50%, Pneus 15%). Fila da manhã disparou automaticamente sem Roberto tocar em nada.

**Jornada:** Na quarta-feira seguinte, 3 clientes aparecem. Carlos Ferreira, Corolla, 14 meses sem voltar: "Roberto, boa memória!" Roberto não lembrou — a Prema lembrou. Dashboard: R$4.800 atribuído, Lucro Bruto estimado R$3.100.

**Resolução:** Três meses depois: agenda previsível, horários mortos preenchidos, paz mental. Segunda de manhã: "28 clientes previstos essa semana, R$18k esperado."

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | ERP conectado + histórico importado                                |
| Objetivo             | Primeira receita atribuída ≤ 21 dias                              |
| Métrica de sucesso   | ≥ 1 Carlos retornou e pagou via funil Prema em 21 dias             |
| Threshold de falha   | Zero receita atribuída em 30 dias                                  |
| Intervenção          | Dashboard previsão semanal; fila automática ativa                  |
| North Star impactada | Receita Atribuída (primária)                                       |
| Impacto              | LTV Roberto; taxa de reativação Carlos                             |

---

### Jornada 2 — Roberto Owner/Single: Edge Case (ERP Desconectado)

**Persona:** Roberto Mendes, 38 anos. ERP local da década de 2010. Perde conexão a cada reinício do servidor.

**Cena:** Sexta de manhã. ERP sem OS novas há 48h. Alerta automático às 8h50: "ERP desconectado — nenhuma OS nova recebida."

**Jornada:** CS aciona Roberto em < 2h. 10 minutos de orientação: CSV manual. Roberto importa OS dos últimos 3 dias. Fluxo retomado. Zero dados perdidos. Gap aparece no dashboard como "importado manualmente" — rastreável e auditável.

**Resolução:** Roberto estabelece CSV como backup semanal. Falha vira rotina gerenciada.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | ERP desconectado há 48h                                            |
| Objetivo             | Gap de dados ≤ 48h; fluxo retomado em < 2h após alerta            |
| Métrica de sucesso   | CSV importado e processado em < 2h após alerta                     |
| Threshold de falha   | Dados parados > 72h sem intervenção                                |
| Intervenção          | Alerta 8h50; CS contacta Roberto em < 2h; guia CSV                |
| North Star impactada | Receita Atribuída (continuidade)                                   |
| Impacto              | Retenção Roberto; qualidade de dados; confiança no produto         |

---

### Jornada 3 — Carlos "Responde e Agenda": Happy Path

**Persona:** Carlos Ferreira, 34 anos. Motorista de app, Corolla 2019, ~8.000 km/mês. Uso Severo. 14 meses sem voltar.

**Cena:** No sinal, esperando cliente. Mensagem chega: *"Seu Corolla está próximo do intervalo recomendado de troca de óleo 5W-30. Baseado no seu perfil de uso, recomendamos agendar em até 15 dias."*

**Jornada:** Carlos responde em 2 min. Agendamento confirmado. Aparece. Paga R$240. "Vocês são os únicos que me avisam na hora certa." NPS 10. Funil completo: Enviada ✓ → Visualizada ✓ → Respondeu ✓ → Agendou ✓ → Apareceu ✓ → Pagou ✓.

**Resolução:** Carlos vira "Severo mapeado" — ciclo 45 dias. Indica dois amigos.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | Mensagem personalizada por veículo e perfil enviada                |
| Objetivo             | Funil completo: Enviada → Pagou                                   |
| Métrica de sucesso   | Comparecimento + pagamento registrado no funil                     |
| Threshold de falha   | Carlos responde mas não aparece (no-show)                          |
| Intervenção          | Confirmação automática de agendamento; lembrete 24h antes          |
| North Star impactada | Receita Atribuída (realização); taxa de retorno                    |
| Impacto              | LTV Carlos; NPS; taxa de retorno                                   |

---

### Jornada 4 — Carlos "Ignora": Reativação

**Persona:** Carlos Oliveira, 52 anos. Gerente CLT, Hilux da empresa. 1 OS há 14 meses (pneu furado, emergência).

**Cena:** Mensagem 1 — técnica, sem pressão. Carlos lê, não responde. Sistema aguarda 3 semanas. Mensagem 2 — enquadramento diferente: diagnóstico gratuito. Carlos responde: "Sexta pode ser."

**Jornada:** Aparece. Dois pneus trocados. R$900. 38 dias, 2 mensagens, conversão. Dado alimenta algoritmo de cadência para perfis semelhantes.

**Resolução:** Carlos passa de Ocasional para potencialmente recorrente. Aprendizado de segmento registrado no algoritmo.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | Mensagem enviada; Carlos não responde                              |
| Objetivo             | Conversão em ≤ 2 mensagens com cadência inteligente                |
| Métrica de sucesso   | Resposta na 2ª mensagem + comparecimento                           |
| Threshold de falha   | 3 mensagens sem resposta → perfil bloqueado temporariamente        |
| Intervenção          | Cadência 3 semanas; 2ª msg com enquadramento benefício             |
| North Star impactada | Taxa de reativação; receita ocasional                              |
| Impacto              | LTV Carlos Ocasional; WABA health                                  |

---

### Jornada 5 — Carlos "Bloqueia/Spam": Risco

**Persona:** Carlos Rodrigues, 29 anos. 3 mensagens em 15 dias (óleo, NPS, campanha). Bloqueia o número ou marca spam na Meta.

**Cena:** Sistema detecta bloqueio. Opt-out implícito processado automaticamente em < 5 min. Se spam Meta: alerta de taxa > 0,5% enviado para Roberto e CS.

**Jornada:** Envios para aquele número param. CS aciona Roberto. Cadência recalibrada para perfis similares. Conta WABA não banida. Carlos "Spam" vira dado de aprendizado global.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | Carlos bloqueia número ou marca como spam                          |
| Objetivo             | Zero bans WABA; opt-out processado < 5 min                         |
| Métrica de sucesso   | Taxa de spam WABA < 0,5% mantida                                   |
| Threshold de falha   | Conta WABA suspensa                                                |
| Intervenção          | Parada automática; alerta Roberto + CS; ajuste de cadência         |
| North Star impactada | WABA health (existencial)                                          |
| Impacto              | Proteção canal; ajuste de algoritmo de cadência global             |

---

### Jornada 6 — Integrador ERP/TI: Habilitador Técnico

**Persona:** Marcos, 35 anos. Consultor TI, 12 oficinas clientes. 3 assinaram a Prema com ERPs diferentes (Oficina Fácil, AutoGestão, sistema legado).

**Cena:** Precisa integrar 3 ERPs. 2 têm conector nativo. 1 é legado — usa CSV estruturado via e-mail.

**Jornada:** 3º dia: 12 linhas CSV rejeitadas (campo km ausente). Relatório de validação automático identifica o problema. Marcos corrige. Em 24h: dados corretos. Acesso ao painel de status (conectado/desconectado/erro) sem ver conteúdo das OS.

**Resolução:** 3 oficinas integradas. Marcos escala o modelo para novas oficinas como serviço de TI.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | Marcos precisa integrar ≥ 1 ERP com a Prema                       |
| Objetivo             | Integração ativa em < 48h; ≥ 95% OS sem erro de validação         |
| Métrica de sucesso   | 95%+ das OS importadas com sucesso; zero falha silenciosa          |
| Threshold de falha   | Integração falhando silenciosamente > 24h                          |
| Intervenção          | Relatório de validação automático; painel de status                |
| North Star impactada | Ativação de Robertos (habilitador)                                 |
| Impacto              | Escalabilidade de onboarding; CAC operacional                      |

---

### Jornada 7 — Equipe Prema Ops/CS: Monitoramento Interno

**Persona:** Ana, CS da Prema. Monitora saúde de todas as oficinas e resolve incidentes.

**Cena:** 8h50. Alerta: "2 oficinas sem OS há 24h." Painel interno: Oficina SP Norte desconectada há 26h. ERP ativo (ping ok), mas sem OS exportadas. Causa suspeita: atualização do ERP quebrou conector.

**Jornada:** Ana aciona Roberto via WhatsApp. Confirma: atualização mudou formato do arquivo. Orienta CSV manual. Equipe técnica corrige conector até o dia seguinte. Incidente registrado com root cause.

**Resolução:** MTTR < 4h. Zero perda de dados. Root cause entra no backlog: "Oficina Fácil v3.2 — prioridade de correção."

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | Alerta: oficina sem OS há 24h                                      |
| Objetivo             | Incidente resolvido em < 4h; zero perda de dados                   |
| Métrica de sucesso   | MTTR < 4h; dado recuperado                                         |
| Threshold de falha   | Incidente > 48h sem resolução                                      |
| Intervenção          | Painel interno + alerta 8h50; CS aciona Roberto via WhatsApp       |
| North Star impactada | Retenção Roberto; qualidade de dados                               |
| Impacto              | Churn prevention; produto health                                   |

---

### Jornada 8 — Roberto: Abandono Silencioso (Ativação Falha) ⚠️ P0

**Persona:** Roberto Nunes, 45 anos. Conectou o ERP. Acessou uma vez. Não configurou margens. Não respondeu alertas. Zero login após dia 5.

**Sinais de Alerta (objetivos):**
- Não configurou margens em 7 dias
- Zero clientes reativados em 14 dias
- Zero login após dia 5
- Não abriu dashboard de previsão

**Jornada de Intervenção Progressiva:**
- Dia 7: Tutorial contextual automático no produto (2 min)
- Dia 14: Relatório automático — "X clientes prontos para retorno esta semana — configure em 2 cliques"
- Dia 21: CS humano aciona Roberto via WhatsApp
- Dia 25: Simulação de receita potencial perdida — "Você deixou R$X na mesa nos últimos 25 dias"

**Resolução:** Roberto ativado antes do cancelamento. Primeira receita atribuída ≤ 21 dias = entrada na jornada de sucesso.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | Zero login + zero margens configuradas em 7 dias                   |
| Objetivo             | Primeira receita atribuída ≤ 21 dias                              |
| Métrica de sucesso   | Login ativo + ≥ 1 Carlos retornou em 21 dias                      |
| Threshold de falha   | Zero receita atribuída em 30 dias → churn precoce                  |
| Intervenção          | Dia 7: tutorial; Dia 14: relatório auto; Dia 21: CS; Dia 25: simulação perda |
| North Star impactada | Ativação; MRR (retenção early)                                     |
| Impacto              | LTV; churn rate; NRR                                               |

---

### Jornada 9 — Atendente: Da Resposta ao Agendamento ⚠️ P1

**Persona:** Fernanda, recepcionista da Oficina Carvalho. Cuida do WhatsApp e do agendamento. Sem ela, a conversão morre no meio.

**Cena:** Carlos respondeu a mensagem da Prema. Fernanda recebe notificação imediata. Tem contexto completo disponível em uma tela.

**Contexto disponível para Fernanda:**
- Última OS de Carlos (serviço, data, km)
- Motivo da campanha (ciclo de retorno previsto)
- Perfil do cliente (Severo, alta frequência)
- Script sugerido

**Jornada:** Fernanda usa o script. Confirma agendamento em 8 minutos com 2 cliques. Carlos recebe confirmação automática.

**Risco mapeado:** Resposta > 60 min = queda de 40% na probabilidade de comparecimento.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | Carlos respondeu mensagem — atendente precisa agir                 |
| Objetivo             | Agendamento confirmado em ≤ 10 min                                |
| Métrica de sucesso   | Tempo médio de resposta ≤ 10 min; conversão ≥ benchmark           |
| Threshold de falha   | Tempo de resposta > 60 min = queda significativa de conversão      |
| Intervenção          | Notificação imediata; tela contexto (OS + perfil + script); confirmação 1 clique |
| North Star impactada | Receita Atribuída (conversão)                                      |
| Impacto              | Taxa de conversão mensagem → pagamento                             |

---

### Jornada 10 — Roberto: Quase Cancela ⚠️ P0

**Persona:** Roberto Lima, 3 meses de uso. Mês fraco. 2 agendamentos. Abre a página de cancelamento.

**Sinais de churn detectados:** Login caiu + receita atribuída caiu + abertura de página de cancelamento.

**Jornada:** Dashboard de retenção automático: "Antes de sair — veja o que a Prema gerou nos últimos 90 dias." Mostra: 47 clientes recuperados (invisíveis sem funil), ROI acumulado, projeção de perda futura se desligar. Botão: "Conversar com especialista."

**Resolução:** 40%+ dos Robertos nesta situação recuperados com visualização do ROI acumulado.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | Login caiu + receita caiu + abertura de página cancelamento        |
| Objetivo             | Recuperar Roberto antes do cancelamento                            |
| Métrica de sucesso   | Taxa de recuperação de churn > 40%                                 |
| Threshold de falha   | Roberto cancela sem intervenção                                    |
| Intervenção          | ROI 90 dias + clientes recuperados + simulação perda futura + call estratégica |
| North Star impactada | MRR (retenção); Churn                                              |
| Impacto              | LTV; churn rate                                                    |

---

### Jornada 11 — Roberto: Expansão / Upsell (Roadmap)

**Persona:** Roberto Almeida, 8 meses de uso. ROI acumulado > 5x. Abrindo segunda unidade.

**Cena:** Dashboard mostra: "Você poderia gerar +R$X ativando o módulo de comparativo por unidade."

**Jornada:** Roberto clica. Tela de upgrade em 1 clique. Ativa painel multi-loja. Começa a comparar performance entre as 2 unidades.

| Campo                | Valor                                                              |
|----------------------|--------------------------------------------------------------------|
| Evento inicial       | ROI acumulado > 5x ou ativação de multi-unidade                    |
| Objetivo             | Upgrade de plano ou expansão de módulos                            |
| Métrica de sucesso   | NRR > 110%                                                         |
| Threshold de falha   | Roberto não vê módulos adicionais nem é abordado                   |
| Intervenção          | Dashboard "+R$X em módulo Y"; botão upgrade 1 clique               |
| North Star impactada | MRR (expansão); NRR                                                |
| Impacto              | LTV Roberto; ARR                                                   |

---

### Personas Complementares

**Carlos Frota/Empresa:** Veículo CNPJ, decisão compartilhada. Mensagem menos emocional — botão "Enviar proposta formal". Agendamento condicionado à aprovação interna. Métrica: conversão B2B vs B2C separada.

**Carlos Baixa Literacia Digital:** Não usa botões. Responde "Ok" ou não responde. Prefere ligação. Fallback automático para ligação, texto simplificado, botão "Prefere que liguemos?". Métrica: taxa de resposta em canal alternativo.

**Roberto Influenciador:** Alto ROI, satisfeito, indica espontaneamente. Dashboard: "Você já gerou R$X para sua oficina." Botão "Indicar amigo" + incentivo. Métrica: taxa de aquisição via referral.

**Carlos Promotor:** Após NPS 9-10: mensagem automática de indicação. "Indique um amigo e ganhe diagnóstico gratuito." Métrica: CAC reduzido via boca a boca estruturado.

**Fornecedor/Distribuidor (P4+):** Se Prema prevê 1.284 trocas de óleo em maio para uma rede: fornecedor pode oferecer desconto por volume antecipado. Cria moat de dependência estratégica + aumenta margem do Roberto.

---

### Anti-Personas

| Anti-Persona                                  | Risco                                            |
|-----------------------------------------------|--------------------------------------------------|
| Oficina sem registro de km nas OS             | Motor de predição degradado; dados inúteis       |
| Oficina sem ERP (controle no papel)           | Sem fonte de dados estruturada; produto não opera|
| Oficina que quer disparo em massa sem critério| Conta WABA em risco; spam sistêmico              |
| Carlos que explicitamente recusou contato     | LGPD; opt-out permanente obrigatório             |

---

### Governança por Jornada (RACI Simplificado)

| Jornada               | Produto                  | CS                    | Marketing              | Fundador                    |
|-----------------------|--------------------------|-----------------------|------------------------|-----------------------------|
| J0 Descoberta         | Calculadora + onboarding | —                     | Conteúdo educativo     | Definir Aha target          |
| J8 Abandono Silencioso| Detectar sinais          | Intervir Dia 21       | Tutorial Dia 7         | Definir threshold churn     |
| J9 Atendente          | Tela de contexto         | Monitorar conversão   | —                      | SLA de resposta             |
| J10 Quase Cancela     | Dashboard ROI            | Call estratégica      | —                      | Política de retenção        |
| J11 Expansão          | Dashboard upsell         | Call de expansão      | —                      | Pricing de módulos          |

---

### Journey Requirements Summary

| Jornada                   | Capacidades Críticas Reveladas                                         |
|---------------------------|------------------------------------------------------------------------|
| J0 Descoberta             | Calculadora receita potencial, onboarding ≤ 12 min, Aha imediato      |
| J1 Roberto Sucesso        | Motor predição, dashboard previsão semanal, funil completo, margens    |
| J2 ERP Fail               | Alerta 48h, CSV manual, resiliência ≥3 fontes, auditoria por origem   |
| J3 Carlos Agenda          | Msg personalizada, 1-clique agendamento, funil, NPS auto, perfil Severo|
| J4 Carlos Ignora          | Cadência inteligente, 2ª msg enquadramento diferente, aprendizado      |
| J5 Carlos Spam            | Opt-out implícito, alerta WABA, parada automática, saúde do canal      |
| J6 Integrador TI          | API, conectores, CSV validado, painel status, permissão granular       |
| J7 Equipe Prema           | Painel interno, alerta 8h50, MTTR < 4h, backlog técnico               |
| J8 Abandono Silencioso    | Sinais ativação, tutorial D7, relatório D14, CS D21, simulação D25    |
| J9 Atendente              | Notif imediata, tela contexto (OS+perfil+script), confirmação 1 clique |
| J10 Quase Cancela         | Dashboard ROI 90d, clientes recuperados, simulação perda, call         |
| J11 Expansão              | Dashboard "+R$X módulo Y", upgrade 1 clique, NRR tracking             |

---

## Domain-Specific Requirements

A Prema opera em dois domínios regulatórios com impacto direto na arquitetura e no produto: **LGPD** (dados de consumidores Carlos) e **políticas Meta/WhatsApp** (canal primário de comunicação).

### Compliance & Regulatory

#### LGPD (Lei Geral de Proteção de Dados)

**Papéis jurídicos formalizados:**

| Papel | Entidade | Responsabilidade |
|---|---|---|
| Operadora | Prema | Processa dados em nome de Roberto — sem decisão sobre finalidade |
| Controlador | Roberto (Oficina) | Decide o quê e por quê coletar dados de Carlos |
| Titular | Carlos (Consumidor) | Direito de consentimento, acesso, correção e exclusão |

**Requisitos de produto:**
- **Opt-in:** Carlos autoriza relacionamento via WhatsApp no primeiro contato. Prema provê o mecanismo de consentimento embarcado — Roberto é o responsável legal, mas o produto executa o fluxo automaticamente
- **Opt-out:** Carlos pode solicitar exclusão a qualquer momento — Prema fornece fluxo automatizado de opt-out (parar envios + sinalizar exclusão) sem exigir ação manual do Roberto
- **Retenção pós opt-out:** Política mínima a definir com assessoria jurídica — auditoria vs. direito ao esquecimento
- **Educação do Roberto:** Produto deve comunicar que Roberto é Controlador e fornecer template de política de privacidade para a oficina expor ao Carlos

**Riscos:**
- Roberto pode não saber que é Controlador → passivo jurídico indireto para Prema
- Opt-out executado fora do produto (WhatsApp manual) → inconsistência no sistema de registro — Prema deve ser o sistema de registro autoritativo

#### Meta / WhatsApp Business (WABA)

**Status atual:** Duas APIs em uso simultâneo:
- **WABA oficial:** ≥95% entrega, custo por mensagem, sem risco de banimento
- **API não-oficial (web emulation):** <75% entrega, sem custo direto, banimentos e desconexões recorrentes — já causando incidentes com Robertos

**Problema estratégico:** Robertos escolhem API não-oficial para evitar custo por mensagem — sem visibilidade do custo real de banimentos e desconexões.

**Requisitos de conformidade:**
- **Calculadora de ROI de migração:** Produto deve apresentar simulação de custo API oficial vs. receita perdida por banimento/desconexão — argumento de negócio, não técnico
- **Aprovação de templates:** Processo hoje manual (equipe Prema) → requisito: fluxo integrado de submissão e aprovação via Meta API
- **Categoria de templates:** Priorizar **Utility** (lembrete de manutenção, notificação de serviço) sobre **Marketing** — menor custo por mensagem, menor risco de rejeição
- **Algoritmo anti-banimento (API não-oficial):** Para Robertos ainda em API não-oficial — simular comportamento humano via WhatsApp Web:
  - Escalada progressiva de volume (não enviar em massa no dia 1)
  - Intervalos randomizados entre mensagens
  - Controle de horários (evitar madrugada e feriados)
  - Limite diário configurável por número
- **Rate limits WABA:** Tier-based — volume aumenta conforme histórico de qualidade de mensagens e pagamento Meta

**Riscos:**
- Banimentos temporários são incidente recorrente — impactam NPS do Roberto e confiabilidade do produto diretamente
- Meta pode alterar políticas unilateralmente (rented infrastructure) — mitigação P3: multicanal (SMS/email como fallback)

### Technical Constraints

#### API de Placa — Dependência Crítica Multi-Source

**Estratégia:** Multi-fornecedor para resiliência — Serpro, Detran estadual, fornecedores privados (seleção a validar na fase técnica)

**Dados mínimos obrigatórios para Janela de Ouro:**
1. Contato do Carlos (WhatsApp/telefone)
2. Km atual registrado na OS (via ERP)
3. Placa do veículo → modelo, motor, capacidade, intervalos recomendados (via API de placa)

**Comportamento de degradação graciosa:**
- API disponível → Janela de Ouro personalizada completa (4 fontes cruzadas)
- API indisponível → Opera com ERP + perfil coletado + dados históricos em cache local
- Sem placa + sem histórico → Carlos entra em fila de recuperação genérica com intervalo padrão configurável pelo Roberto
- **Regra:** Produto **nunca bloqueia** por falta de dado externo — degrada mantendo o máximo de personalização disponível

**Riscos:**
- Dependência de terceiro sem SLA formal → cache local de consultas já realizadas como mitigação
- Variação de cobertura por estado (Detran estadual)
- Custo de consultas em escala (Carloses × Robertos × veículos)

#### ERP de Oficina — Normalização e Integração

**Status atual:** 15+ ERPs integrados; schema parcialmente padronizado — não cobre todos os casos

**Dados mínimos obrigatórios por integração:**

| Campo | Tipo | Obrigatoriedade |
|---|---|---|
| Contato do cliente | WhatsApp/telefone | Obrigatório — sem contato = Carlos não existe no produto |
| Km na entrada da OS | Numérico (normalizado) | Obrigatório para Janela de Ouro |
| Placa do veículo | String | Obrigatório para API de placa |
| Data do serviço | Data | Obrigatório para cálculo de intervalo |
| Tipo/categoria do serviço | Texto livre | Desejável — normalização necessária na ingestão |

**Política de negociação com ERPs:**
- **NDA explícito:** Prema não construirá ERP próprio — remove barreira de competição percebida e facilita parceria
- **Termo de integração:** ERPs parceiros notificam breaking changes com antecedência mínima contratualmente definida
- **Fallback:** ERPs sem API nativa → importação por CSV/planilha como rota de ativação enquanto integração nativa não existe

**Riscos:**
- Km em texto livre ("cento e vinte mil km") → normalização obrigatória na ingestão de dados
- Ausência de km em OSs históricas → Janela de Ouro inicia parcial na maioria dos Robertos no onboarding
- ERP parceiro pode revogar acesso → diversificação + política contratual de continuidade

### Integration Requirements

| Sistema | Tipo | Criticidade | Status Atual |
|---|---|---|---|
| WhatsApp WABA (Meta) | Canal primário | P0 — missão crítica | Parcial (dual API) |
| WhatsApp API não-oficial | Canal legado | Risco — descontinuar progressivamente | Ativo |
| API de Placa (multi-source) | Enriquecimento de dados | P1 — central à Janela de Ouro | Em validação |
| ERPs de Oficina (15+) | Fonte OS/histórico | P0 — sem ERP = sem produto | Parcial |
| Email/SMS | Canal contingência | P3 — fallback | Não implementado |

### Risk Mitigations

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| Banimento de número WhatsApp | Alto | Alta (já ocorre) | Algoritmo anti-banimento + migração WABA oficial |
| Mudança de política Meta | Alto | Média | Multicanal P3 (SMS/email como fallback) |
| Indisponibilidade API de placa | Médio | Baixa-Média | Cache local + degradação graciosa + multi-source |
| ERP revoga acesso de integração | Alto | Baixa | NDA + termo de continuidade contratual |
| Roberto desinformado como Controlador LGPD | Médio | Alta | Educação embarcada + templates de política de privacidade |
| Opt-out executado fora do produto | Alto | Média | Prema como sistema de registro autoritativo — automatizado |

---

## Innovation & Novel Patterns

### Detected Innovation Areas

#### Inovação 1 — Motor de Predição Personalizada com Agente de Interpretação por IA

**O que é:** Sistema de predição de retorno em duas camadas — interpretação e predição — operando sobre dados heterogêneos de 15+ ERPs, conversas e API de placa.

**Por que é inovador:** Concorrentes usam regras fixas por tempo ("envie após 6 meses"). O Prema cruza 4 fontes de dados por Carlos, por veículo, por tipo de serviço — e expõe o nível de confiabilidade da predição como feature, não como bug.

**Camada 1 — Agente de Interpretação de OS (IA)**
- Normaliza texto livre, semântica variável, slang regional, quantidades de pneus (1/2/3/4/5)
- Diferencia troca vs. manutenção ("balanceamento" ≠ troca de pneu)
- Captura sinais de contexto do Carlos em conversa ("comprei usado", "faço revisão na concessionária")
- O agente não prediz — **normaliza para que a predição seja confiável**
- Cada correção do mecânico realimenta o modelo progressivamente

**Camada 2 — Motor de Predição (Regras + Calibração)**

Estimativa de km/mês por nível de confiabilidade:

| Nível | Dados disponíveis | Confiabilidade |
|---|---|---|
| 1 — Fallback | km atual + ano do veículo | Baixa — média histórica |
| 2 — 2 pontos | km + data de 2 OS distintas | Média |
| 3 — Multi-ponto | 3+ registros com datas | Alta — ponderada por intervalo |

3 ciclos-mãe com critério universal **vencimento = min(data, km):**

| Ciclo | Normal | Severo |
|---|---|---|
| Troca de Óleo | 10.000 km / 12 meses | 5.000 km / 6 meses |
| Troca de Pneus | 30–50k km / 3–4 anos | Varia por uso |
| Manutenção de Pneus | 10.000 km / 6 meses | Após impacto/substituição |

**Princípios de design:**
- **Confiabilidade explícita:** nunca exibir "vence em 15/03" com dado fraco — exibir "estimativa: fev–abr (confirme km)" quando dados são insuficientes
- **Mecânico como co-autor:** input pós-diagnóstico realimenta o motor
- **Carlos como sensor:** informar km via mensagem simples é o gesto de maior ROI — deve ser o mais fácil possível
- **Inteligência cross-service:** troca de pneus sem troca de óleo → estima km atual e dispara campanha de óleo com bônus consultivo

---

#### Inovação 2 — Motor de ROI e Agenda Previsível

**O que é:** Sistema que transforma a gestão da oficina em receita previsível — Roberto configura seu negócio, o produto identifica ociosidade, calcula quanto precisa trazer de Carloses para encher a agenda, e prova o retorno sobre o investimento em Prema + Meta.

**Por que é inovador:** Não existe no Brasil para oficinas independentes. O conceito de CAC, LTV e ROI de campanha existe no mundo das startups — o Prema traduz para a realidade do Roberto: bays vazios, agenda com buracos, investimento visível, resultado mensurável.

**Como funciona:**

Roberto configura o contexto do negócio:
- Número de clientes ativos na base
- Capacidade do estabelecimento (número de baias/elevadores)
- Ticket médio por tipo de serviço
- Meta de receita mensal

O produto identifica e quantifica:
- **Ociosidade:** quantas horas de baia ficam vazias por dia/semana
- **Gap de agenda:** quantos Carloses precisam retornar por mês para encher a capacidade
- **Potencial de receita:** base de Carloses inativos × ticket médio × taxa de conversão esperada

O produto calcula e exibe:
- Investimento total: Prema subscription + gasto Meta (API WABA)
- Carloses reativados atribuídos ao período
- Receita Estimada Atribuída (configurada por Roberto: MO 100%, Peças 50%, Pneus 15%)
- **ROI = Receita Estimada Atribuída / (Investimento Prema + Meta)**

**Output para Roberto:**
> "Você investiu R$X (Prema + WhatsApp). Trouxe Y Carloses de volta. Gerou R$Z estimado em receita. ROI: W%. Sua agenda tinha 35% de ociosidade — hoje está em 12%."

**Princípios de design:**
- "Receita **Estimada** Atribuída" — transparência sobre o modelo (correlação ≠ causalidade), protege de conflito com contabilidade do Roberto
- **Grupo de controle passivo:** diferença entre Carloses contatados vs. não contatados — comparação mais convincente que número absoluto
- Ociosidade é a linguagem do Roberto — é o custo invisível que o produto torna visível
- O ROI é primariamente **ferramenta de retenção do Roberto** — ele vê resultado → fica

---

#### Inovação 3 — Identidade Pessoa-centric + Ecossistema de Vida Automotiva

> ⚠️ **Escopo:** A **Identidade Pessoa-centric** (WhatsApp como chave primária, múltiplos veículos, reconciliação de identidade) é **escopo MVP**. O componente de **Ecossistema de Vida Automotiva** (IPVA · licenciamento · multas · seguro · revisão obrigatória) é **Roadmap P3** — execução condicionada à validação de CTR ≥ 15% com 50 Carloses antes de iniciar sprint dedicado.

**O que é:** Carlos não é apenas um cliente da oficina — é um proprietário de veículo com obrigações, custos e riscos anuais que vão além da manutenção. O Prema expande o relacionamento para cobrir toda a **vida financeira do carro**, com o Roberto como canal de confiança e a Prema como plataforma white label.

**Por que é inovador:** Transforma a oficina de "lugar onde conserto o carro" para "parceiro de toda a vida do meu veículo". Nenhum CRM automotivo no Brasil cobre esse escopo. A oficina se torna o elo de confiança para todas as obrigações do Carlos.

**Identidade Pessoa-centric (base):**

WhatsApp como chave primária — decisão deliberada de design:
- Usuários não abrem apps, não checam email
- Carlos pode ter múltiplos veículos (produto mantém contexto de cada um)
- Carlos pode trocar de carro (histórico de relacionamento persiste — veículo é atributo mutável)
- Carlos pode visitar múltiplas oficinas Prema (grafo de relacionamento acumulado)

**Identidade resiliente:**
- WhatsApp como chave primária + fallback identifiers: CPF (fragmento), nome + placa, nome + bairro
- **Graceful identity merge:** quando Carlos aparece com número diferente em segundo Roberto, sistema sinaliza possível duplicata e permite merge confirmado
- Consentimento natural: "Posso manter contato sobre suas próximas manutenções?" — conversa, não formulário

**Ecossistema de Vida Automotiva:**

| Obrigação do Carlos | Integração possível | Valor para Carlos | Valor para Roberto |
|---|---|---|---|
| IPVA | Consulta por placa (Detran/Serpro) | Lembrete de vencimento por estado/final de placa | Motivo de contato proativo |
| Licenciamento | Consulta por placa | Alerta de prazo + orientação de documentação | Tráfego adicional |
| Multas | Consulta por placa/CPF (Detran) | Visibilidade de multas ativas | Fidelidade por utilidade |
| Seguro | Parceiro/corretoras | Lembrete de renovação + cotação | Receita de indicação (opcional) |
| Revisão obrigatória | Por estado (ex.: RJ) | Lembrete de prazo | Agendamento direto |
| Financiamento/consórcio | Informação coletada em conversa | Alerta de parcelas | Contexto de perfil financeiro |

**Efeito estratégico:**
- Carlos engaja com a plataforma **entre** manutenções — não só quando o carro quebra
- Roberto se torna o **ponto de confiança** para toda a vida do veículo do Carlos
- **Prema é white label** — cada Roberto oferece esse ecossistema com sua própria marca, fortalecendo exclusividade com o cliente
- O ecossistema aumenta o **LTV do Carlos por Roberto** e cria switching cost real: mudar de oficina significa perder a "central do meu carro"

**Efeito de rede (P4+):**
Grafo `Carlos ↔ veículos ↔ oficinas ↔ obrigações` acumulado com escala de Robertos — ativo de dados proprietário sem equivalente no mercado. Valor atual é por-Roberto; efeito de rede é roadmap.

---

### Market Context & Competitive Landscape

- CRMs automotivos existentes (Driva, Gro CRM): veículo como entidade central, gatilho por tempo fixo, sem atribuição financeira, sem ecossistema de vida automotiva
- **Motor de ROI com ociosidade:** inexistente no segmento de oficinas independentes no Brasil
- **Ecossistema de vida automotiva via oficina:** inexistente — nenhum player conecta manutenção + IPVA + seguro + multas via WhatsApp com white label para Roberto
- **Interpretação semântica de OS por IA:** nenhum concorrente opera nesta camada de normalização

---

### Validation Approach

| Inovação | Como Validar | Threshold |
|---|---|---|
| Agente de Interpretação de OS | Classificação do agente vs. mecânico em 500 OS | Precisão ≥ 85% |
| Estimativa de km/mês | km estimado vs. km real no retorno | Erro médio ≤ 15% (nível 2) |
| Motor de ROI + Ociosidade | Cohort com dashboard ROI vs. controle: diferença em churn | Redução de churn ≥ 30% |
| Ecossistema de Vida Automotiva | Engajamento de Carlos em mensagens não-mecânicas | CTR ≥ 15% em avisos IPVA/multa/seguro |
| Identidade resiliente | Carloses reconciliados após troca de número | Merge correto ≥ 80% dos casos detectados |

---

### Risk Mitigation

| Risco | Mitigação |
|---|---|
| Agente IA erra categorização → predição errada | Confiabilidade explícita exibida; mecânico corrige e realimenta o modelo |
| km estimado impreciso | Range exibido quando confiabilidade baixa; Carlos confirma km via mensagem |
| Roberto não configura ociosidade/meta | Onboarding guiado com defaults por tamanho de estabelecimento |
| Integração Detran instável (IPVA/multas) | Cache de última consulta + fallback para informação manual do Carlos |
| White label mal configurado pelo Roberto | Templates pré-aprovados + onboarding de marca em < 5 min |
| Efeito de rede prometido antes da escala | Posicionamento explícito: valor atual = por-Roberto; rede = roadmap P4+ |

---

## SaaS B2B2C Specific Requirements

### Project-Type Overview

O Prema é uma plataforma **B2B2C white label** onde:
- **Prema (plataforma)** → fornece o motor invisível
- **Roberto (tenant)** → opera, configura, e apresenta como sua própria marca
- **Carlos (consumidor final)** → nunca vê a Prema; interage apenas com a marca do Roberto via WhatsApp e domínio neutro

Isso distingue o Prema de um SaaS B2B convencional: a entrega de valor ao Roberto é inseparável da experiência do Carlos — a qualidade do relacionamento com Carlos **é** o produto que Roberto compra.

> **Regra de ouro:** Carlos nunca deve saber que existe Prema. Isso é o moat operacional do produto.

---

### Tenant Model

**Arquitetura: Tenant = Marca / CNPJ / Grupo**

```
Tenant (grupo/marca)
  └── Store (unidade/filial)
        └── Users (dono, gerente, atendente...)
        └── Carlos base (isolada por store_id)
        └── WhatsApp number (por unidade)
        └── ERP connection (por unidade)
```

**Isolamento de dados:**
- Isolamento primário por `tenant_id`
- Sub-escopo por `store_id`
- RLS (Row Level Security) **hard no banco** (PostgreSQL): `WHERE tenant_id = auth.tenant_id AND store_id IN (allowed_store_ids)`
- Testes automatizados de isolamento cross-tenant em CI — não apenas convenção de código

**Hierarquia de acesso:**

| Papel | Escopo de Stores | Visão |
|---|---|---|
| Dono (Owner) | Todas as unidades do grupo | Consolidado + por unidade |
| Regional | Unidades atribuídas | Consolidado regional |
| Gerente | 1 unidade | Operacional da unidade |
| Atendente | 1 unidade | Histórico completo do Carlos + conversa ativa |

**Escalabilidade do modelo:**
- 1 loja: tenant com 1 store — sem complexidade extra
- 30 lojas: tenant com 30 stores — dono vê consolidado, regionais veem subset
- Multi-CNPJ (franquia/rede): múltiplos tenants com hierarquia de marca — roadmap P4+

**White Label — camadas:**

| Camada | Configurável | Carlos vê? |
|---|---|---|
| Nome da oficina | ✅ Por store | ✅ Sim |
| Logo | ✅ Por tenant | ✅ Sim |
| Cor primária | ✅ Por tenant | ✅ Sim |
| WhatsApp remetente | ✅ Por store (número próprio do Roberto) | ✅ Sim |
| Assinatura de mensagem | ✅ Por store | ✅ Sim |
| Domínio de avaliação | Neutro (`revisaoautomotiva.com`) + token opaco por campanha · `noindex` obrigatório | ✅ Sem marca Prema visível |
| Dashboard do Roberto | Marca Prema visível (B2B) | ❌ Roberto acessa, Carlos nunca vê |

---

### Architecture Decision Records

#### ADR-01: Tenant = Grupo (não Unidade)

**Decisão:** ✅ Tenant = Grupo/Marca · Store = Sub-tenant com RLS hard no banco

| Trade-off | Impacto | Mitigação |
|---|---|---|
| Migração de Robertos atuais (possivelmente modelados como tenant único) | Médio | Migration script na entrada do P4 (multi-loja) |
| Complexidade de queries com store_id em todo o schema | Médio | Abstrair em middleware/service layer |
| RLS mal configurado = vazamento cross-tenant | Alto | Testes automatizados de isolamento em CI |

**Razão:** Único modelo que suporta visão consolidada multi-loja, billing centralizado por grupo e escala sem refatoração.

#### ADR-02: White Label — Domínio Neutro com Token Opaco

**Decisão:** ✅ Domínio neutro + token opaco por campanha · `noindex` · logo/nome/cor como identidade principal

| Trade-off | Impacto | Mitigação |
|---|---|---|
| Carlos descobre domínio compartilhado | Médio | `noindex` + token opaco + sem breadcrumb de tenant |
| Roberto não "possui" o domínio | Baixo | Focar white label no WhatsApp e comunicação |
| Subdomínio próprio por Roberto | Opcional P4+ | Wildcard SSL + DNS automation (Cloudflare) |

**Razão:** Complexidade de infra de subdomínio próprio por Roberto não se justifica no valor percebido pelo Carlos.

#### ADR-03: RBAC + Feature Gating por Plano

**Decisão:** ✅ RBAC + feature gating server-side · Admin Prema com auditoria obrigatória e impersonation

- Permissões = interseção(papel, plano): Dono no plano Mensurar tem menos acesso que Dono no Recuperar em certas features
- Admin Prema: auditoria full + impersonation (não login direto como Roberto) + 2FA para ações destrutivas
- ABAC reservado para P5+ (ex: "atendente só vê Carloses com km > 50.000")

| Trade-off | Impacto | Mitigação |
|---|---|---|
| Permissões = papel ∩ plano — complexidade de UI | Médio | Preview com CTA de upgrade para features bloqueadas |
| Admin Prema cross-tenant | Alto | Auditoria full + impersonation + 2FA |
| RBAC não cobre casos granulares futuros | Baixo agora | Arquitetura preparada para ABAC em P5+ |

#### ADR-04: Feature Flags Server-side (não Plan Entitlements Rígidos)

**Decisão:** ✅ Feature flags server-side por tenant · Preview com dados reais bloqueado para ação · Basic Capado = subset de flags desabilitadas

- Validação de entitlement **sempre server-side** — front-end só exibe/esconde baseado no estado retornado pelo servidor
- Preview: Roberto vê dashboard de recuperação com dados reais, mas sem poder disparar — urgência de upgrade imediata
- Basic Capado: `automation_enabled=false` + `recovery_enabled=false` — dados e integração preservados

| Trade-off | Impacto | Mitigação |
|---|---|---|
| Flag validation client-side | Alto — bypass de paywall | Enforcement server-side obrigatório em todas as APIs |
| Preview com dados reais | Médio — risco "gratis forever" | Preview = leitura apenas, zero disparo |
| Proliferação de feature flags | Médio — debt técnico | Feature flag registry com owner + deprecation policy |

---

### RBAC Matrix

| Permissão | Dono | Regional | Gerente | Atendente | Integrador TI | Financeiro | Equipe Prema |
|---|---|---|---|---|---|---|---|
| Ver todas as unidades | ✅ | Subset | ❌ | ❌ | ❌ | ❌ | ✅ (admin) |
| Configurar campanha | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Ver histórico completo do Carlos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Responder Carlos (WhatsApp) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Configurar ERP/integrações | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Ver dashboard ROI | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Acessar faturas/billing | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Configurar plano/upgrade | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Acesso multi-tenant (suporte) | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (impersonation) |
| Opt-out Carlos | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |

> **Atendente:** acessa histórico completo do Carlos — necessário para atendimento consultivo e para ajudar Carlos a economizar com manutenções.

---

### Subscription Tiers

**Arquitetura de 6 camadas:**

| Plano | Público | Faixa de Preço/unidade | Objetivo estratégico |
|---|---|---|---|
| Free (Lead Engine) | ✅ | R$0 | Mostrar tamanho do problema, sem ERP |
| Trial ERP | ✅ | R$0 / 14–30 dias | Máquina de conversão com impacto real |
| Mensurar | ✅ | R$297–R$397 | Entrada paga — inteligência e controle |
| Fidelizar | ✅ | R$597–R$697 | Core revenue — novo ticket médio alvo |
| Recuperar | ✅ | R$897–R$1.297 | Alta performance — crescimento acelerado |
| Basic Capado | ❌ (invisível) | R$147–R$197 | Anti-churn — só ativado no momento de cancelamento |

**Funil de upgrade:**
```
Free → Trial ERP → Mensurar → Fidelizar → Recuperar
                                              ↑
                          Basic Capado ←← (rota de saída interceptada)
```

**Detalhes por plano:**

**Free — Lead Engine** (sem ERP, CSV manual, 50 clientes/mês)
- Inclui: Dashboard básico · 3 Ciclos-Mãe · Status ativo/inativo · Simulação Janela de Ouro · Relatório de potencial de faturamento perdido
- Não inclui: Automação · WhatsApp ativo · Campanhas · Recuperação

**Trial ERP** (14 ou 30 dias, 1.000 clientes ativos)
- Integração ERP · WhatsApp ativo · 3 Ciclos funcionando · Recuperação básica · Sem relatórios avançados

**Mensurar** (R$297–R$397/unidade, até 2.500 clientes)
- Integração ERP · Dashboard completo · Classificação automática · Indicadores de churn

**Fidelizar** (R$597–R$697/unidade)
- Tudo do Mensurar + 3 Ciclos ativos · Automação WhatsApp · Janela de Ouro · Segmentações · Campanhas preventivas

**Recuperar** (R$897–R$1.297/unidade)
- Tudo do Fidelizar + Recuperação automática · IA de priorização · Campanhas com incentivo · Multi-unidade básico

**Basic Capado** (R$147–R$197/unidade — invisível, só no fluxo de cancelamento)
- `automation_enabled=false` · `recovery_enabled=false` · Integração ERP ativa · Histórico preservado · Possibilidade de reupgrade mantida

---

### Integration List

| Sistema | Tipo | Criticidade | Status |
|---|---|---|---|
| WhatsApp WABA (Meta) | Canal primário | P0 | Parcial (dual API) |
| WhatsApp API não-oficial | Canal legado | Risco — migrar progressivamente | Ativo |
| ERPs de Oficina (15+) | Fonte OS/histórico | P0 | Parcial |
| API de Placa (multi-source) | Enriquecimento veicular | P1 | Em validação |
| Detran/Serpro (IPVA, multas) | Ecossistema Carlos | P2 | Não iniciado |
| Corretoras de Seguro | Ecossistema Carlos | P3 | Não iniciado |
| Email/SMS | Canal contingência | P3 | Não implementado |

---

### Compliance Requirements

- **LGPD:** Prema = Operadora · Roberto = Controlador · Carlos = Titular. Fluxos de opt-in e opt-out embarcados no produto. Atendente acessa histórico completo — justificado por modelo de serviço consultivo
- **Meta/WABA:** Migração progressiva para API oficial · Templates categoria Utility · Algoritmo anti-banimento para API não-oficial em uso
- **Isolamento de dados:** RLS hard no banco · Testes automatizados de isolamento cross-tenant em CI
- **Admin Prema:** Impersonation (não login direto) · Auditoria de todas as ações · 2FA para operações destrutivas

---

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**Contexto:** Produto híbrido em produção com 170+ Robertos pagantes e MRR de R$47k. O "MVP" aqui é a **evolução estruturada do produto existente** em fases que maximizam receita, reduzem churn e entregam as inovações planejadas. Nenhuma fase é puramente técnica — cada fase deve mover MRR, reduzir churn ou aumentar ticket médio.

**Filosofia:** Revenue MVP — evidência de ROI para Roberto em cada fase.

**Meta:** R$200k MRR · ≤ 3% churn · 308 Robertos ativos · Dez/2026

---

### Sequência de Execução (Pre-mortem aplicado)

```
Sprint 0 (Imediato):      Fix Recuperar + P0 infraestrutura de canal [BLOQUEANTE]
Sprint 1–2 (Q1 2026):     Fidelizar completo (indicação + bônus acumulados)
Sprint 3–4 (Q1–Q2 2026):  P1 Funil + onboarding obrigatório de margem
Sprint 5–6 (Q2 2026):     Agente IA v1 (3 sinais) + Predição básica
Sprint 7+ (Q3–Q4 2026):   Ecossistema Carlos + Agente IA v2 + Multi-loja básico
```

> **Bloqueante crítico:** Recuperar tem Robertos pagantes com produto não funcionando. Nenhuma nova feature até Recuperar atingir NPS interno ≥ 70 com esses Robertos.

---

### Mapeamento P0–P5 × Subscription Tiers

| Fase | Tier | Entrega central | Status |
|---|---|---|---|
| **Sprint 0 — Fix + Canal** | Todos | Fix Recuperar · Anti-banimento · Feriados · Horários · Calculadora ROI WABA | 🔴 Bloqueante |
| **Fidelizar — Base** | Plano Fidelizar | NPS pós-serviço · Bonificações · Promotores · Programa de indicação com bônus acumulados | 🟡 Parcial (170 Robertos) |
| **P1 — Funil + North Star** | Plano Mensurar | Funil completo (Enviada→Paga) · North Star · Margens obrigatórias no onboarding · Motor de ROI + Ociosidade | 🔴 Pendente |
| **P2 — Recuperar (IA + Predição)** | Plano Recuperar | Agente IA v1 (3 sinais) · Predição progressiva · Inativos 1-10 anos · Import ERP/CSV · Campanha cruzada | 🔴 Produto existente com problema |
| **P3 — Ecossistema Carlos** | Add-on / Recuperar+ | IPVA · Multas · Seguro · Licenciamento · Monetização B2C via white label | 🔵 Roadmap Q3-Q4 |
| **P4 — Multi-loja** | Enterprise | Tenant=Grupo · RBAC hierárquico · Dashboard consolidado | 🔵 Roadmap |
| **P5 — Plataforma** | Enterprise+ | Efeito de rede · Grafo Carlos↔veículos↔oficinas · NRR > 110% | 🔵 Visão |

---

### Detalhamento por Fase

#### Sprint 0 — Fix Recuperar + Infraestrutura de Canal (BLOQUEANTE)

**Recuperar fix:**
- Diagnosticar e corrigir os problemas atuais do plano Recuperar (produto não entregando)
- Meta: NPS interno ≥ 70 com Robertos atuais do plano antes de avançar

**P0 Infraestrutura de Canal (todos os planos):**
- Respeito a feriados nacionais e estaduais na fila de envio
- Horários configuráveis de disparo por Roberto
- Algoritmo anti-banimento (API não-oficial): escalada progressiva de volume · intervalos randomizados · limite diário configurável
- Calculadora de ROI para migração WABA oficial
- Fluxo integrado de aprovação de templates categoria Utility

---

#### Fidelizar — Relacionamento Base (Q1 2026)

**É o produto base dos 170 Robertos. É retenção, não growth.**

- Disparo de mensagem pós-serviço para mensuração de NPS
- Identificação de promotores, neutros e detratores
- **Programa de bonificação:** bônus acumulados para próxima manutenção
- **Programa de indicação:** Carlos promotor indica amigo → ambos ganham bônus · mais indicações = mais ganhos acumulados
- Identificação dos melhores Carloses (LTV alto, frequência, Severo)
- Garantia estendida · promoções sazonais · ações de relacionamento
- Retornos esperados: 6+ meses (ciclo longo de construção de relacionamento)

> **Por que é Q1 e não "depois":** Sem programa de indicação funcionando, Roberto não consegue explicar o valor da Prema para outros Robertos. A indicação boca-a-boca é o principal canal de aquisição.

---

#### P1 — Funil + North Star (Q1–Q2 2026)

- Funil de Atribuição completo: Enviada → Visualizada → Respondeu → Agendou → Apareceu → Pagou
- North Star: Receita Estimada Atribuída com margens configuradas
- **Onboarding obrigatório de margem:** Roberto não completa setup sem configurar pelo menos um valor padrão (MO 100%, Peças 50%, Pneus 15% sugeridos). Sem margem = North Star mostra R$0 = churn.
- Motor de ROI + Ociosidade: Roberto configura capacidade e meta → produto mostra gap e resultado
- Grupo de controle passivo (Carloses contatados vs. não contatados)

---

#### P2 — Recuperar Completo (Q2 2026)

- **Agente IA v1 (escopo mínimo — 3 semanas, não 4 meses):** identifica apenas 3 sinais (óleo, troca de pneus, manutenção de pneus). Precisão aceitável: 70% com fluxo de correção pelo mecânico. Cada correção alimenta o modelo.
- **Motor de Predição progressivo:** inicia com fallback (média histórica) → evolui com dados reais de cada Carlos conforme chegam. Produto nunca bloqueia por falta de dado.
- Segmentação de inativos por tempo: 1, 2, 3, 5, 10 anos
- Comunicação personalizada por perfil (Severo/Normal/Ocasional/Carlos Trocador)
- Import via ERP API ou planilha/CSV
- Campanha cruzada: trocou pneus → óleo com bônus consultivo
- Valorização dos clientes já fidelizados

---

#### P3 — Ecossistema de Vida Automotiva (Q3–Q4 2026)

> **Validar antes de construir:** Pesquisa com 50 Carloses ativos antes de iniciar sprint. CTR esperado ≥ 20% para justificar desenvolvimento.

- IPVA: lembrete de vencimento por estado/final de placa
- Licenciamento: alerta de prazo
- Multas: consulta por placa/CPF via Detran
- Seguro: lembrete de renovação + integração com corretoras parceiras
- **Monetização B2C:** Roberto como canal de conversão para seguros → receita de indicação
- White label completo em todas as comunicações

---

#### Free Tier — Funil de Conversão Embutido

- Dia 3: "Conecte seu ERP e veja seus Carloses reais"
- Dia 7: se sem ERP → oferta de Trial com suporte de onboarding
- Dia 14: se sem conversão → sequência "tamanho do problema" (quanto está perdendo)
- Lead scoring automático: Free com ERP conectado = lead quente para CS

---

### Risk Mitigation Strategy

| Risco | Impacto | Prevenção |
|---|---|---|
| Recuperar não corrigido → churn de alto valor | Crítico | Sprint 0 bloqueante — fix antes de qualquer nova feature |
| Margem não configurada → North Star = R$0 | Alto | Onboarding obrigatório com valores sugeridos |
| Agente IA super-engenheirado → delay | Alto | v1 = 3 sinais · 3 semanas · 70% precisão aceitável |
| Programa de indicação "para depois" | Alto | Feature de Q1 — é retenção, não growth |
| Free tier sem conversão → CS overwhelmed | Médio | Nudge automatizado D3/D7/D14 + lead scoring |
| Concorrente captura mercado Q2 2026 | Médio | Funil + Predição básica visíveis e funcionando até Abr/2026 |
| Ecossistema Carlos: baixo engajamento | Médio | Validar CTR com 50 Carloses antes do sprint |

---

### Team Requirements

| Capacidade | Sprint 0 | Fidelizar | P1 | P2 | P3 |
|---|---|---|---|---|---|
| Backend/API | ✅ | ✅ | ✅ | ✅ | ✅ |
| Frontend/Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI/ML Engineer | ❌ | ❌ | ❌ | ✅ | ❌ |
| WhatsApp/Integrations | ✅ | ✅ | ✅ | ✅ | ✅ |
| Data Engineering | ❌ | ❌ | ✅ | ✅ | ✅ |
| Product Design (UX) | ✅ | ✅ | ✅ | ✅ | ✅ |
| QA | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Functional Requirements

Os requisitos funcionais definem o contrato de capacidades da Prema — o que o sistema pode fazer, sem prescrever como é implementado. Cada FR é testável, rastreável a uma jornada do usuário e alinhado com os critérios de sucesso definidos nas seções anteriores.

> **Contrato de Capacidades v5.2** · 64 FRs · 11 áreas · 49 MVP · 15 V2
>
> Qualquer feature não listada aqui não será projetada, arquitetada ou implementada sem decisão explícita de adicionar ao contrato.

---

### 1. Gestão de Canal de Comunicação

- **FR1** `MVP · P` Roberto pode configurar horários de envio por dia da semana e faixa horária por unidade
- **FR2** `MVP · P` O sistema respeita calendário de feriados nacionais e estaduais ao enfileirar mensagens
- **FR3** `MVP · M` O sistema gerencia volume e cadência de envio respeitando limites técnicos do canal configurado por store. Cada store define `channel_type`: `WABA_OFICIAL` (padrão para novos tenants) | `WABA_NAO_OFICIAL`. Cada tipo aplica regras de rate limit, anti-spam e comportamento de escalada de volume distintas.
- **FR4** `MVP · M` Roberto pode visualizar calculadora de ROI comparando custo da API oficial vs. receita estimada perdida por banimentos
- **FR5** `MVP · M` Roberto pode submeter, acompanhar aprovação e gerenciar biblioteca de templates Utility com alertas de rejeição, suspensão e performance. MVP rastreia: taxa de resposta e taxa de opt-out. Alerta quando opt-out supera threshold configurável (padrão 5%) ou resposta cai abaixo da média histórica por margem configurável. Taxa de conversão para agendamento = V2.
- **FR6** `MVP · P` Roberto pode configurar número WhatsApp remetente por unidade
- **FR7** `MVP · P` O sistema detecta e alerta Roberto quando número WhatsApp é banido ou desconectado
- **FR8** `MVP · P` Carlos pode solicitar opt-out e o sistema interrompe automaticamente todos os envios para esse Carlos
- **FR9** `MVP · M` O sistema registra status de entrega por mensagem e, quando não entregue, executa: (1) reenvio automático configurável em até 24h; (2) move para fila manual do atendente, que aparece na tela de histórico do Carlos (FR53) com badge de "Entrega Pendente" — não existe tela dedicada. Canal SMS como fallback: **fora do escopo MVP Brasil**. Ativação disponível como canal alternativo para expansão EUA — requer decisão explícita.

---

### 2. Motor de Predição e Inteligência

- **FR10** `MVP · G` O sistema estima km médio mensal por 4 níveis de confiabilidade com ranges explícitos: **Nível 0** — sem km disponível → usa média nacional de 1.200 km/mês, exibido com label "estimativa inicial"; **Nível 1** ±30% (fallback histórico); **Nível 2** ±15% (2 pontos); **Nível 3** ±8% (multi-ponto ponderado)
- **FR11** `MVP · M` Carlos pode informar km atual via WhatsApp sem necessidade de serviço associado. Cada atualização registra: valor anterior · timestamp · origem (Carlos via WhatsApp / atendente manual). Usuário autorizado pode reverter para valor anterior.
- **FR12** `MVP · G` O sistema identifica serviços realizados em OS com texto livre com taxa mínima de 70% de precisão sobre amostra contendo pelo menos um dos 3 Ciclos-Mãe validada manualmente, enfileirando itens não-classificados para revisão do mecânico.
- **FR13** `MVP · M` O sistema reconhece quantidade de pneus trocados (1–5) e diferencia troca de manutenção (balanceamento ≠ troca de pneu)
- **FR14** `MVP · M` Mecânico pode corrigir classificações de serviço identificadas pelo sistema, e cada correção realimenta o modelo de aprendizado
- **FR15** `MVP · M` O sistema calcula data e km de vencimento para cada ciclo usando critério min(data, km). Para predições Nível 1 (±30%), o km de vencimento usa o **limite inferior do range** como threshold conservador — ex.: km estimado 50.000 ±30% → threshold de vencimento por km = 35.000, evitando acionamento prematuro por estimativa imprecisa.
- **FR16** `MVP · G` O sistema apresenta ao Roberto justificativa da predição via template estruturado com variáveis fixas: *"Carlos não voltou há X meses. Último serviço: [tipo]. Km estimado: [Z] (confiabilidade: baixa/média/alta)."* Narrativa contextual inteligente adaptada ao perfil = V2.
- **FR17** `V2 · G` O sistema captura sinais de contexto do Carlos em conversas que alteram o perfil de uso (ex.: "comprei usado", "faço revisão na concessionária")
- **FR18** `V2 · M` O sistema detecta troca de pneus sem troca de óleo recente e habilita campanha cruzada com incentivo consultivo

---

### 3. Relacionamento e Fidelização

- **FR19** `MVP · M` O sistema dispara mensagem de NPS automaticamente após conclusão de serviço registrado no ERP
- **FR20** `MVP · M` Roberto pode visualizar segmentação de Carloses por resultado de NPS (promotores, neutros, detratores)
- **FR21** `MVP · M` O sistema gera workflow de acompanhamento para Carloses detratores com notificação ao Roberto. SLA de resolução: 48h. Se "ação tomada" não for registrada em 48h, Roberto recebe re-alerta automático com escalação para o gerente da unidade. Workflow se encerra quando Roberto registra resolução formal.
- **FR22** `V2 · G` Carlos promotor pode receber convite para indicar amigos com bônus configurável para ambos, com validação de primeira OS paga como prevenção de fraude
- **FR23** `V2 · M` O sistema acumula bônus por indicações realizadas e aplica automaticamente na próxima manutenção do Carlos
- **FR24** `V2 · M` Roberto pode criar e configurar campanhas de bonificação, promoção sazonal e garantia estendida
- **FR25** `V2 · M` Roberto pode identificar Carloses de maior valor (LTV, frequência, perfil Severo) e criar ações exclusivas para esse grupo

---

### 4. Recuperação de Clientes Inativos

- **FR26** `MVP · M` Roberto pode importar base de clientes via integração ERP por API ou planilha/CSV
- **FR27** `MVP · M` O sistema segmenta automaticamente clientes inativos por tempo desde último serviço (1, 2, 3, 5, 10+ anos)
- **FR28** `MVP · G` O sistema prioriza fila de campanhas com fallback hierárquico quando histórico de funil é insuficiente: (1) proximidade de vencimento · (2) LTV histórico de OS · (3) ordem cronológica de inatividade. Engenheiro não define essa lógica. Nota: esta regra governa a **ordenação geral da fila** entre diferentes Carloses. Para colisão de campanhas sobre o **mesmo Carlos**, aplica-se FR46.
- **FR29** `MVP · G` O sistema gera comunicação personalizada por perfil de Carlos para campanhas de recuperação. Regras formalizadas de classificação de perfil: **Severo** — km estimado > 1.000/mês ou ≥ 3 visitas no último ano; **Normal** — km 500–1.000/mês ou 1–2 visitas no último ano; **Ocasional** — km < 500/mês ou < 1 visita no último ano; **Trocador** — OS com troca de peças sem serviço de MO associado no mesmo período. Thresholds configuráveis por tenant. A classificação usa o **ponto central** da estimativa de km, não o range. Reclassificação ocorre apenas quando Carlos recebe novo serviço no ERP ou atualiza km manualmente — nunca entre aprovação e disparo. A campanha aprovada usa a classificação do momento da aprovação como valor imutável até a conclusão do ciclo de envio.
- **FR30** `MVP · M` Roberto pode revisar e aprovar campanhas de recuperação antes do disparo
- **FR31** `V2 · M` O sistema diferencia comunicação para clientes já fidelizados vs. inativos no mesmo fluxo de recuperação
- **FR32** `V2 · M` O sistema executa campanha cruzada automaticamente quando detecta pneus trocados sem óleo recente no período relevante

---

### 5. Atribuição de Receita e ROI

- **FR33** `MVP · P` Roberto configura margens padrão por categoria de serviço (MO, Peças, Pneus) como etapa obrigatória do onboarding, com valores sugeridos pré-preenchidos
- **FR34** `MVP · G` O sistema rastreia funil completo de atribuição por Carlos: Enviada → Visualizada → Respondeu → Agendou → Apareceu → Pagou. Eventos de "Apareceu" e "Pagou" aceitam duas fontes: (1) ERP — sincronização automática quando OS é gerada; (2) Confirmação manual pelo atendente. Quando nenhuma fonte confirma em 24h após agendamento, estado fica em "Pendente" com alerta ao atendente até resolução manual.
- **FR35** `MVP · M` Roberto pode visualizar Receita Estimada Atribuída por campanha e por período com margem aplicada. Exibição separada obrigatória: **Confirmada** — Carloses com "Apareceu"/"Pagou" registrados via ERP ou confirmação manual; **Em aberto** — Carloses com "Apareceu"/"Pagou" pendentes, calculados pela taxa histórica de conversão Agendou→Pagou do tenant como proxy. Os dois valores têm labels distintos e não são somados em total único.
- **FR36** `MVP · M` O sistema calcula e exibe ROI do período: Receita Estimada Atribuída / (investimento Prema + Meta)
- **FR64** `MVP · M` Roberto pode visualizar saldo de créditos de campanha disponíveis, consumo por campanha e por período, e recebe alerta quando o saldo atinge threshold configurável. Criação de nova campanha é bloqueada quando saldo = 0, com indicação do motivo e link para recarga.
- **FR37** `V2 · M` Roberto pode configurar capacidade do estabelecimento (baias/elevadores), com inferência baseada em histórico quando dado manual não é fornecido
- **FR38** `V2 · M` O sistema identifica e exibe ociosidade do estabelecimento com base em capacidade configurada e taxa histórica de conversão
- **FR39** `V2 · G` O sistema permite criação de grupo de controle aleatorizado para medição de impacto incremental de campanhas
- **FR40** `V2 · G` Roberto pode realizar teste A/B de mensagens e comparar taxas de conversão entre variantes

---

### 6. Identidade do Carlos

- **FR41** `MVP · G` O sistema mantém Carlos como entidade central com múltiplos veículos como atributos mutáveis independentes
- **FR42** `MVP · M` O sistema reconcilia identidade do Carlos usando: CPF completo → merge automático; nome + placa exatos → sugestão de merge manual para Roberto confirmar; demais casos → nova entidade. Correspondência parcial de primeiro nome (ex.: "Carlos F. Silva" vs. "Carlos Silva"), mesmo com placa idêntica, **não constitui match exato** — tratada como nova entidade salvo confirmação manual do Roberto. Em merge confirmado: entidade mais antiga = registro base; histórico da secundária é anexado; dados conflitantes preservados com marcação de origem e timestamp; última atualização manual prevalece como valor ativo; flag "registro reconciliado" criada para auditoria. Score probabilístico e heurísticas avançadas = V2.

---

### 7. Governança de IA e Controle de Pressão

- **FR43** `MVP · P` Roberto pode desativar temporariamente automações de campanha para ciclo específico sem perder configurações
- **FR44** `MVP · M` O sistema mantém log auditável de decisões automatizadas de campanha, predição e envio, acessível por Roberto e equipe Prema. Retenção: 12 meses. Em solicitação de exclusão (FR49): dados pessoais no log são anonimizados, preservando apenas metadados técnicos.
- **FR45** `MVP · P` Roberto pode configurar limite máximo de contatos por Carlos em período definido
- **FR46** `MVP · M` O sistema impede sobreposição de campanhas ativas para o mesmo Carlos. Quando duas campanhas elegíveis colidem: prioriza a com vencimento mais próximo; se empate → maior LTV estimado. Campanha suprimida é registrada e exibida ao Roberto como "Suprimida por conflito" com motivo. Nota: esta regra governa **colisão pontual** (mesmo Carlos, campanhas elegíveis simultâneas). FR28 governa a ordenação geral da fila. Quando há conflito direto sobre o mesmo Carlos, FR46 prevalece e o resultado ocupa a posição definida pela fila de FR28.
- **FR47** `V2 · G` O sistema projeta volume de disparos com base na capacidade operacional configurada e taxa histórica de conversão, alertando quando projeção excede capacidade antes do disparo

---

### 8. LGPD e Compliance

- **FR48** `MVP · M` O sistema permite exportar todos os dados do Carlos sob solicitação formal
- **FR49** `MVP · M` O sistema permite anonimizar ou excluir definitivamente dados do Carlos conforme solicitação formal registrada com confirmação de conclusão
- **FR50** `MVP · M` O sistema registra e exibe trilha completa de consentimento e opt-in/opt-out por Carlos com timestamp

---

### 9. Gestão da Conta Roberto (Tenant, White Label, Subscription)

- **FR51** `MVP · P` Roberto pode configurar identidade visual da conta (nome, logo, cor primária) aplicada em todas as comunicações com Carlos
- **FR52** `MVP · M` Roberto pode convidar usuários e configurar permissões por papel (gerente, atendente, integrador TI, financeiro)
- **FR53** `MVP · M` Atendente pode visualizar histórico completo do Carlos e contexto da conversa ativa durante atendimento
- **FR54** `V2 · M` Roberto pode visualizar preview de funcionalidades de planos superiores com dados reais, bloqueadas para ação, com comunicação transparente sobre o mecanismo no onboarding
- **FR55** `MVP · M` O sistema apresenta plano Basic Capado com manutenção de dados e integração ERP ativa quando Roberto inicia fluxo de cancelamento
- **FR56** `V2 · M` Roberto Dono pode comparar desempenho entre unidades por taxa de retorno, receita atribuída e NPS

---

### 10. Integrações e Dados Externos

- **FR57** `MVP · M` Roberto pode conectar ERP via API com configuração guiada e validação de dados mínimos obrigatórios
- **FR58** `MVP · G` O sistema normaliza dados de km e categorias de serviço provenientes de diferentes ERPs na ingestão
- **FR59** `MVP · M` O sistema consulta dados do veículo por placa via múltiplas fontes com degradação graciosa quando fonte primária indisponível
- **FR60** `MVP · M` O sistema mantém cache local de dados de veículos consultados para resiliência a indisponibilidade de APIs externas

---

### 11. Ciclo de Vida de Campanha, Templates e Onboarding

- **FR61** `MVP · M` O sistema gerencia campanhas com estados formais e transições controladas:

  | Transição | Ator | Condição |
  |---|---|---|
  | Rascunho → Aguardando Aprovação | Roberto (ação de submissão) | Itens 1–4 do FR63 completos |
  | Aguardando Aprovação → Ativa | Sistema (automático) | Template aprovado pela Meta (FR62) |
  | Ativa → Pausada | Roberto (manual) | Qualquer momento |
  | Pausada → Ativa | Roberto (manual) | Template ainda válido |
  | Ativa / Pausada → Concluída | Sistema (automático) | Público atingido ou data fim |
  | Qualquer → Cancelada | Roberto (manual, irreversível) | Qualquer momento |
  | Qualquer estado com template → Rascunho | Sistema (automático) | Template associado rejeitado pela Meta — Roberto notificado com motivo de rejeição |

  Transições inválidas são bloqueadas pelo sistema. FR30, FR43, FR46 e FR47 dependem deste estado.

- **FR62** `MVP · P` Apenas Roberto Dono ou Gerente pode submeter templates para aprovação Meta. Atendente pode usar templates aprovados na biblioteca. Nenhum papel pode editar template com aprovação ativa sem nova submissão.
- **FR63** `MVP · M` O sistema bloqueia ativação de envios com granularidade: itens 1–4 do onboarding (identidade visual · margem · WhatsApp · ERP/CSV) bloqueiam criação e execução de campanhas; item 5 (template aprovado) bloqueia apenas execução. Estado visual obrigatório quando aguardando Meta: *"Aguardando aprovação Meta (estimativa: 24–72h). Você pode criar campanhas em rascunho."* Progresso do checklist persiste entre sessões.

---

### Roadmap — Fora do Contrato MVP

**Ecossistema de Vida Automotiva (P3):** IPVA · Licenciamento · Multas via Detran · Seguro via corretoras · Revisão obrigatória estadual. Validar CTR com 50 Carloses antes de iniciar sprint.

---

### Resumo do Contrato

| Área | FRs | MVP | V2 |
|---|---|---|---|
| 1. Canal de Comunicação | FR1–FR9 | 9 | 0 |
| 2. Motor de Predição | FR10–FR18 | 7 | 2 |
| 3. Relacionamento e Fidelização | FR19–FR25 | 3 | 4 |
| 4. Recuperação de Inativos | FR26–FR32 | 5 | 2 |
| 5. Atribuição e ROI | FR33–FR40, FR64 | 5 | 4 |
| 6. Identidade do Carlos | FR41–FR42 | 2 | 0 |
| 7. Governança de IA | FR43–FR47 | 4 | 1 |
| 8. LGPD e Compliance | FR48–FR50 | 3 | 0 |
| 9. Tenant / White Label | FR51–FR56 | 4 | 2 |
| 10. Integrações | FR57–FR60 | 4 | 0 |
| 11. Ciclo de Vida + Onboarding | FR61–FR63 | 3 | 0 |
| **Total** | **64** | **49** | **15** |

---

## Non-Functional Requirements

> 8 categorias · 32 critérios mensuráveis · Apenas categorias que efetivamente importam para o produto.
>
> **Excluídas deliberadamente:** Acessibilidade (WCAG) — B2B SaaS sem requisito legal; Internacionalização como idioma único no MVP (ver categoria i18n para arquitetura de expansão).

---

### Performance

| NFR | Critério | Justificativa |
|---|---|---|
| NFR-P1: Dashboard | Métricas de 30 dias carregam em < 3s para até 5.000 Carloses. Para até 50.000 Carloses: < 8s, via índices compostos obrigatórios em (tenant_id, store_id, created_at) e paginação de resultados. | Latência visível impacta confiança do Roberto no produto |
| NFR-P2: Fila de envio | Mensagem programada para horário X inicia envio em ≤ 5 min. Conclusão da fila diária: todas as mensagens enfileiradas enviadas dentro da janela 8h–18h configurada. Para volumes > 1.000 msgs/dia por número: sistema distribui automaticamente pela janela sem pico de 100% no início. | Rate médio unitário: ~30 msgs/hora (300/dia em 10h comerciais). Multi-loja: até 200.000/mês via número único respeitando tiers WABA Meta. |
| NFR-P3: Fila multi-loja | Volume de até 200.000 msgs/mês via número único — sistema escala dentro dos tiers WABA Meta automaticamente (Tier 1: 1.000/dia → Tier 3: 100.000/dia) sem intervenção manual. | Maior cenário projetado: redes multi-loja com número compartilhado |
| NFR-P4: Predição | Predição processada em batch com intervalo máximo de 5 min após ingestão de nova OS. Não é processamento síncrono — sem SLA de latência individual por Carlos. | Predição alimenta fila de campanha futura, não interface em tempo real |

---

### Confiabilidade e Disponibilidade

| NFR | Critério |
|---|---|
| NFR-R1: Uptime | 99% mensal (≤ 7h downtime/mês) |
| NFR-R2: Janela de manutenção | Manutenção planejada exclusivamente 20h–6h (horário de Brasília). Zero manutenção não planejada tolerada fora dessa janela. |
| NFR-R3: RTO | Incidente crítico (WABA inativo, ERP desconectado): serviço restaurado em < 2h |
| NFR-R4: RPO | Backups a cada 4h. Perda máxima de dados aceitável: 4h de OSs ingeridas |
| NFR-R5: Capacidade máxima | Suportar cliente com 1.500 veículos ativos/mês em uma única unidade sem degradação de performance ou confiabilidade |
| NFR-R6: Sazonalidade e crescimento | Suportar pico de 2× o volume médio (dezembro) sem degradação. Arquitetura suporta 10× o volume atual (170 → 1.700 Robertos) sem refatoração de infra. |

---

### Segurança

| NFR | Critério | Decisão |
|---|---|---|
| NFR-S1: Dados em trânsito | TLS 1.2+ em todas as comunicações API (interno e externo) | Obrigatório |
| NFR-S2: Dados em repouso | Criptografia at rest no banco de dados | Obrigatório |
| NFR-S3: Field-level encryption | Não obrigatório na fase atual — TLS + at rest é suficiente para o perfil de risco e LGPD | Deferido para P4+ |
| NFR-S4: Isolamento multi-tenant | RLS hard no banco (PostgreSQL) com testes automatizados de isolamento cross-tenant em CI (ADR-01) | Obrigatório |
| NFR-S5: Admin Prema | 2FA obrigatório para operações de impersonation. Session timeout: 8h de inatividade. Geolocalização de acesso: não obrigatório no MVP. | Obrigatório (2FA + timeout) |
| NFR-S6: Auditoria admin | Toda ação de impersonation gera log com: admin ID · tenant afetado · timestamp · ação executada. Retenção: 24 meses. | Obrigatório |
| NFR-S7: Acesso API ERP | Tokens de API com expiração em 90 dias. Notificação proativa ao Roberto e integrador TI 15 dias antes da expiração, com link de renovação self-service de 1 clique. Token nunca expira silenciosamente. | Obrigatório |

---

### Escalabilidade

| NFR | Critério |
|---|---|
| NFR-SC1: Tenant model | Arquitetura suporta crescimento de 170 para 1.700 Robertos (10×) sem refatoração de schema ou infra |
| NFR-SC2: Volume de mensagens | Suportar 200.000 msgs/mês por tenant (rede multi-loja) respeitando rate limits WABA Meta por tier |
| NFR-SC3: Base de Carloses | Suportar até 50.000 Carloses ativos por tenant sem degradação de queries (dashboard < 8s, segmentação, predição) |
| NFR-SC4: Integrações ERP | 15+ ERPs suportados com taxa de erro de normalização de km ≤ 5% e taxa de ingestão ≥ 95% das OSs sem falha silenciosa — independente do número de conectores ativos |

---

### Integrações e Resiliência Externa

| NFR | Critério |
|---|---|
| NFR-I1: ERP desconectado | Detecção de ausência de OSs em < 1h. Alerta ao Roberto via produto em < 2h após detecção. |
| NFR-I2: WABA ban/desconexão | Detecção em < 15 min. Parada automática de envios. Opt-out implícito processado em < 5 min. Alerta Roberto + CS Prema. |
| NFR-I3: API de placa indisponível | Degradação graciosa: sistema opera com cache local de últimas consultas. Zero bloqueio de funcionalidade por indisponibilidade de API externa. |
| NFR-I4: Cache de placa | Cache válido por 30 dias para dados de veículo consultados. Invalidação sob demanda quando nova placa é adicionada. |
| NFR-I5: Monitoramento de spam | Sistema monitora proxy de spam via taxa de opt-out local — disponível imediatamente. Alerta quando opt-out > 0,5% em janela de 24h. Dados oficiais Meta têm lag de 24–48h — usados para revisão retroativa, não alerta em tempo real. |

---

### Observabilidade

| NFR | Critério |
|---|---|
| NFR-O1: Logs de auditoria | Logs de decisão automatizada (campanha, predição, envio) acessíveis por Roberto e equipe Prema. Retenção: 12 meses. Anonimização de dados pessoais em solicitação de exclusão (FR49). |
| NFR-O2: Alertas operacionais | Equipe Prema notificada em < 15 min para: WABA ban · API de placa indisponível > 1h · tenant sem OS novas > 48h · ERP desconectado > 1h |
| NFR-O3: Painel de saúde interno | Equipe Prema acessa visibilidade de saúde de todas as unidades com latência ≤ 5 min: status ERP · status WABA · volume de mensagens enviadas · taxa de engajamento por tenant |

---

### Persistência de Estado

| NFR | Critério |
|---|---|
| NFR-PE1: Onboarding (FR63) | Estado do checklist de onboarding persiste indefinidamente entre sessões. Campos preenchidos não são perdidos. Ao reabrir, Roberto retoma exatamente no item onde parou com dados pré-carregados. |
| NFR-PE2: Campanhas em Rascunho | Campanhas em estado Rascunho e Aguardando Aprovação persistem indefinidamente até ação explícita de cancelamento ou aprovação. |
| NFR-PE3: Cache de predição | Estimativa de km e perfil de Carlos invalidados apenas por evento (novo serviço no ERP ou atualização manual de km pelo Carlos). Carlos inativo > 18 meses: estimativa recalculada com Nível 0 (média nacional de 1.200 km/mês) na próxima campanha, com label "estimativa atualizada após longa inatividade". Dado original preservado no histórico. |

---

### Internacionalização (i18n)

**Horizonte:** Português (Brasil) · Espanhol (América Latina + Espanha) · Inglês (Estados Unidos)

| NFR | Critério |
|---|---|
| NFR-IN1: Arquitetura de locale | Sistema suporta troca de locale sem rebuild ou redeploy — arquitetura de resource files por locale com hot-reload. MVP entrega apenas `pt-BR`. |
| NFR-IN2: Localização de data/hora/moeda | Todos os valores de data, hora e moeda usam formatação locale-aware. Timestamps armazenados em UTC e exibidos no timezone configurado pelo tenant. Moeda configurável por tenant (BRL padrão). |
| NFR-IN3: Templates WhatsApp multilíngue | Sistema de templates suporta múltiplas versões por idioma por tenant. Roberto pode configurar idioma padrão da unidade. |
| NFR-IN4: Compliance por jurisdição | Módulo de compliance desenhado para suportar regras regulatórias por país sem refatoração completa. Estimativa de esforço por nova jurisdição: < 6 semanas incluindo camada de compliance, extensão de schema e validação jurídica. LGPD (Brasil) MVP · GDPR (Espanha/EU) e CCPA (EUA) = P5+. |
| NFR-IN5: API de placa por mercado | Integração com API de placa desenhada para múltiplos provedores por país. Brasil = Serpro/Detran. Outros mercados = provedores a definir na fase de expansão. |


