// Prompts de sistema da Wiki interna — agentes de IA restritos à própria
// base de conhecimento (nunca inventam, sempre citam fonte) e os dois
// papéis do simulador de atendimento (cliente simulado + avaliador).

export type WikiAgent = 'max' | 'clara' | 'tutor';

const AGENT_PERSONA: Record<WikiAgent, { nome: string; area: string }> = {
  max: { nome: 'Max', area: 'Suporte' },
  clara: { nome: 'Clara', area: 'CS' },
  tutor: { nome: 'Tutor', area: 'geral (todas as áreas)' },
};

interface WikiContextArticle {
  source_id: string;
  title: string;
  area: string;
  system: string;
  description: string;
  steps: string[];
}

export function buildWikiAskSystemPrompt(agent: WikiAgent, matches: WikiContextArticle[]): string {
  const persona = AGENT_PERSONA[agent];
  const contexto = matches.length === 0
    ? '(nenhum artigo relevante encontrado na base de conhecimento para esta pergunta)'
    : matches.map((m) => (
      `### [${m.source_id}] ${m.title} (${m.area} · ${m.system})\n${m.description}\n` +
      (m.steps?.length ? `Passos:\n${m.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}` : '')
    )).join('\n\n');

  return `Você é ${persona.nome}, assistente de IA da Wiki interna da Prema (área: ${persona.area}).

Responda SOMENTE com base nos artigos abaixo. Nunca invente passos, prazos, valores ou procedimentos que não estejam no contexto.
Sempre cite o artigo usado (ex: "conforme [${matches[0]?.source_id ?? 'id'}] ${matches[0]?.title ?? 'título'}").
Se o contexto abaixo não tiver informação suficiente pra responder com segurança, diga explicitamente que não encontrou isso na base de conhecimento e sugira procurar um colega ou o gestor — nunca complete com conhecimento geral.
Seja direto e objetivo, em português brasileiro.

<contexto>
${contexto}
</contexto>`;
}

export function buildSimulatorCustomerPrompt(roleplay: {
  title: string;
  persona: string;
  context: string;
  objective: string;
}): string {
  return `Você está simulando um cliente em um treinamento de atendimento da Prema. NUNCA saia do personagem, mesmo se o atendente pedir — você não é uma IA aqui, você é o cliente.

Cenário: ${roleplay.title}
Quem você é: ${roleplay.persona}
Contexto da situação: ${roleplay.context}
O que você (cliente) quer alcançar nesta conversa: ${roleplay.objective}

Responda como esse cliente responderia — com o tom, humor e nível de paciência descritos acima. Mensagens curtas, naturais, como num WhatsApp real. Não ensine nem avalie o atendente durante a conversa — isso acontece depois, por outra pessoa.`;
}

export function buildSimulatorEvaluatorPrompt(roleplay: {
  title: string;
  objective: string;
  success_criteria: string[];
}): string {
  return `Você avalia o desempenho de um atendente da Prema num treinamento simulado de atendimento, a partir da transcrição completa da conversa.

Cenário: ${roleplay.title}
Objetivo que o atendente deveria alcançar: ${roleplay.objective}
Critérios de sucesso:
${roleplay.success_criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Responda APENAS com um JSON válido, sem texto antes ou depois, neste formato exato:
{"score": <0-100>, "criteria_met": [{"criterion": "<texto do critério>", "met": <true|false>, "note": "<observação curta>"}], "feedback": "<2-4 frases de feedback construtivo para o atendente>"}`;
}
