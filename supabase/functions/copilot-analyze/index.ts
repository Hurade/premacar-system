import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
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

    const prompt = `Você é um assistente de vendas/suporte analisando uma conversa de WhatsApp da Prema (plataforma de pós-venda automotivo).

Conversa recente (últimas mensagens):
---
${transcript}
---

Responda APENAS com JSON válido neste formato exato:
{
  "context_summary": "resumo do contexto em 1-2 frases",
  "tone": "tom percebido do cliente (ex: interessado, hesitante, frustrado, neutro)",
  "tips": ["dica 1 para melhorar a conversa", "dica 2", "dica 3"],
  "suggested_reply": "sugestão de resposta natural para o atendente enviar agora",
  "next_action": "próxima ação recomendada (ex: qualificar, enviar proposta, agendar demo, encerrar)"
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
