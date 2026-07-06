const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/embeddings';
const DEFAULT_MODEL = 'google/gemini-embedding-2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let model = DEFAULT_MODEL;
    let input = 'dimension probe';
    let dimensions: number | undefined;

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      if (body.model) model = body.model;
      if (body.input) input = body.input;
      if (typeof body.dimensions === 'number') dimensions = body.dimensions;
    } else {
      const url = new URL(req.url);
      model = url.searchParams.get('model') || model;
      const dim = url.searchParams.get('dimensions');
      if (dim) dimensions = Number(dim);
    }

    const payload: Record<string, unknown> = { model, input };
    if (dimensions && model.startsWith('openai/')) payload.dimensions = dimensions;

    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: `AI Gateway ${response.status}`, detail: errText }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const embedding: number[] = data?.data?.[0]?.embedding ?? [];

    return new Response(JSON.stringify({
      model,
      dimensions: embedding.length,
      usage: data.usage,
      sample: embedding.slice(0, 4),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
