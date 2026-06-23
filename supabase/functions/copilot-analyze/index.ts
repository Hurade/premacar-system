const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const { transcript, contactName } = await req.json();

    if (!transcript) {
      return new Response(JSON.stringify({ error: 'transcript is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prompt = `Você é um copiloto de vendas especialista em ajudar SDRs a vender a PremaCar — plataforma SaaS de automação de pós-venda para oficinas mecânicas e auto centers.

SOBRE A PREMACAR:
- Automatiza o contato com clientes inativos via WhatsApp usando IA (agente Cris)
- Recupera clientes que pararam de frequentar a oficina, gerando faturamento automático
- Plano: R$ 650/mês com trial gratuito de 14 dias e setup em 12 minutos
- Diferenciais: IA conversacional, campanhas multi-canal (WhatsApp + ligação + email), múltiplas conexões WhatsApp, pipeline de vendas integrado

CONTEXTO DA CONVERSA (lead = dono/gestor de oficina ou auto center):
---
${transcript}
---

Analise a conversa e responda APENAS com JSON válido neste formato exato:
{
  "context_summary": "resumo do contexto em 1-2 frases — qual é a situação do lead e onde ele está no funil",
  "tone": "tom percebido do lead (ex: interessado, hesitante, frustrado, cético, neutro, animado)",
  "tips": [
    "dica 1 — tática de vendas específica para avançar esse lead (ex: perguntar sobre clientes inativos, mencionar ROI)",
    "dica 2 — como contornar uma objeção ou aprofundar o interesse",
    "dica 3 — próximo gatilho de conversão a usar"
  ],
  "suggested_reply": "sugestão de resposta natural e consultiva que o vendedor pode enviar agora — deve soar humana, não robótica",
  "next_action": "próxima ação comercial recomendada (ex: qualificar tamanho da base, propor demo, enviar case de sucesso, fechar trial, agendar ligação)"
}`;

    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.4
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Copilot] AI error:', response.status, errText);
      throw new Error(`AI error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta inválida da IA');

    const parsed = JSON.parse(jsonMatch[0]);

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
