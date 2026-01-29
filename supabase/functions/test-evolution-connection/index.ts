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
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate URL format
    if (!api_url.startsWith('http://') && !api_url.startsWith('https://')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'URL deve começar com http:// ou https://'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate API key length
    if (api_key.length < 10) {
      return new Response(JSON.stringify({
        success: false,
        error: 'API Key deve ter no mínimo 10 caracteres'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[TestEvolutionConnection] Testing connection to ${api_url} for instance ${instance_name}`);

    // Clean URL (remove trailing slash)
    const baseUrl = api_url.replace(/\/$/, '');

    // Test connection by fetching instance info
    const response = await fetch(`${baseUrl}/instance/fetchInstances`, {
      method: 'GET',
      headers: {
        'apikey': api_key,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TestEvolutionConnection] API error: ${response.status} - ${errorText}`);
      
      return new Response(JSON.stringify({
        success: false,
        error: `Erro na API: ${response.status}`,
        details: errorText
      }), {
        status: 200, // Return 200 so frontend can handle gracefully
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const instances = await response.json();
    console.log(`[TestEvolutionConnection] Found ${instances?.length || 0} instances`);

    // Find the specific instance
    const instance = Array.isArray(instances) 
      ? instances.find((inst: any) => inst.instance?.instanceName === instance_name || inst.instanceName === instance_name)
      : null;

    if (!instance) {
      return new Response(JSON.stringify({
        success: false,
        error: `Instância "${instance_name}" não encontrada`,
        available_instances: Array.isArray(instances) 
          ? instances.map((inst: any) => inst.instance?.instanceName || inst.instanceName).filter(Boolean)
          : []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get connection status
    const instanceData = instance.instance || instance;
    const connectionStatus = instanceData?.state || instanceData?.connectionStatus || 'unknown';
    const isConnected = connectionStatus === 'open' || connectionStatus === 'connected';

    console.log(`[TestEvolutionConnection] Instance found: ${instance_name}, status: ${connectionStatus}`);

    return new Response(JSON.stringify({
      success: true,
      instance_name: instance_name,
      instance_status: connectionStatus,
      is_connected: isConnected,
      message: isConnected 
        ? 'Instância conectada e pronta para uso!' 
        : `Instância encontrada, mas status: ${connectionStatus}`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[TestEvolutionConnection] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 200, // Return 200 so frontend can handle gracefully
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
