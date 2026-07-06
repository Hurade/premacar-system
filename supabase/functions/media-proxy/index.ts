import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadMediaWithType } from "../_shared/media.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mediaId = url.searchParams.get('id');

    if (!mediaId) {
      return new Response(JSON.stringify({ error: 'Missing media id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Busca credenciais Meta + Evolution — o helper compartilhado tenta Meta
    // primeiro e cai para Evolution automaticamente, cobrindo os dois provedores
    // sem o frontend precisar saber qual API originou a mensagem.
    const { data: settings } = await supabase
      .from('nina_settings')
      .select('meta_access_token, evolution_api_url, evolution_api_key, evolution_instance_name')
      .limit(1)
      .maybeSingle();

    if (!settings) {
      return new Response(JSON.stringify({ error: 'Nenhuma configuração de WhatsApp encontrada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const media = await downloadMediaWithType(settings, mediaId);

    if (!media) {
      return new Response(JSON.stringify({ error: 'Falha ao baixar mídia (Meta e Evolution)' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(media.buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': media.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=86400',
      }
    });
  } catch (error) {
    console.error('[Media Proxy] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
