import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { api_url, api_key, instance_name } = await req.json();

    if (!api_url || !api_key || !instance_name) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Campos obrigatórios: api_url, api_key, instance_name'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!api_url.startsWith('http://') && !api_url.startsWith('https://')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'URL deve começar com http:// ou https://'
      }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const baseUrl = api_url.replace(/\/$/, '');
    console.log(`[TestEvolution] Checking connectionState for instance "${instance_name}" at ${baseUrl}`);

    // Endpoint direto: GET /instance/connectionState/{instance}
    // Retorna: { instance: { instanceName, state } } ou { state: 'open' | 'connecting' | 'close' }
    const response = await fetch(`${baseUrl}/instance/connectionState/${instance_name}`, {
      method: 'GET',
      headers: { 'apikey': api_key, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TestEvolution] API ${response.status}:`, errorText);
      return new Response(JSON.stringify({
        success: false,
        error: `Evolution API retornou ${response.status}`,
        details: errorText,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = await response.json();
    console.log(`[TestEvolution] Response:`, JSON.stringify(data));

    // Normaliza resposta — a Evolution API v1/v2 pode retornar formatos diferentes
    const state: string =
      data?.instance?.state ||
      data?.state ||
      data?.connectionStatus ||
      data?.instance?.connectionStatus ||
      'unknown';

    const isConnected = state === 'open';

    return new Response(JSON.stringify({
      success: true,
      is_connected: isConnected,
      instance_status: state,
      message: isConnected
        ? 'Instância conectada e pronta para uso!'
        : `Instância encontrada, status: ${state}`,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[TestEvolution] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
