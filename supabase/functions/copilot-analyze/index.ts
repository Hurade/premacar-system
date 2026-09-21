import { complete } from "../_shared/ai-gateway-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, contactName } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ error: 'transcript is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const system = `Você é um copiloto de vendas especialista em ajudar SDRs a vender a PremaCar — plataforma SaaS de automação de pós-venda para oficinas mecânicas e auto centers.

SOBRE A PREMACAR:
- Automatiza o contato com clientes inativos via WhatsApp usando IA (agente Cris)
- Recupera clientes que pararam de frequentar a oficina, gerando faturamento automático
- Plano: R$ 650/mês com trial gratuito de 14 dias e setup em 12 minutos
- Diferenciais: IA conversacional, campanhas multi-canal (WhatsApp + ligação + email), múltiplas conexões WhatsApp, pipeline de vendas integrado

Analise a conversa que o usuário mandar (lead = dono/gestor de oficina ou auto center) e chame a tool com sua análise.`;

    const parsed = await complete<{
      context_summary: string;
      tone: string;
      tips: string[];
      suggested_reply: string;
      next_action: string;
    }>({
      system,
      messages: [{ role: 'user', content: `CONTEXTO DA CONVERSA:\n---\n${transcript}\n---` }],
      tool: {
        name: 'analise_copiloto',
        description: 'Registra a análise da conversa de vendas',
        input_schema: {
          type: 'object',
          properties: {
            context_summary: { type: 'string', description: 'Resumo do contexto em 1-2 frases — qual é a situação do lead e onde ele está no funil' },
            tone: { type: 'string', description: 'Tom percebido do lead (ex: interessado, hesitante, frustrado, cético, neutro, animado)' },
            tips: {
              type: 'array',
              items: { type: 'string' },
              description: 'Dicas táticas de vendas específicas pra avançar esse lead (objeções, gatilhos de conversão)',
            },
            suggested_reply: { type: 'string', description: 'Sugestão de resposta natural e consultiva que o vendedor pode enviar agora — deve soar humana, não robótica' },
            next_action: { type: 'string', description: 'Próxima ação comercial recomendada (ex: qualificar tamanho da base, propor demo, enviar case de sucesso, fechar trial, agendar ligação)' },
          },
          required: ['context_summary', 'tone', 'tips', 'suggested_reply', 'next_action'],
        },
      },
    });

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Copilot] Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
