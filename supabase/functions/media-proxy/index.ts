import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getOrDownloadMedia } from "../_shared/media.ts";

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

    // Credenciais da CONEXÃO que recebeu essa mídia (mensagem → conversa →
    // conexão) — com múltiplas conexões Evolution (ex: Atendimento,
    // Automax), usar sempre o nina_settings global só funcionava pra
    // conexão legada original; mídia de qualquer outra conexão falhava
    // ao baixar (áudio/vídeo/imagem/anexo não tocava/abria no chat).
    let settings: any = null;
    const { data: msg } = await supabase
      .from('messages')
      .select('conversation_id')
      .eq('media_url', mediaId)
      .limit(1)
      .maybeSingle();

    if (msg?.conversation_id) {
      const { data: conv } = await supabase
        .from('conversations')
        .select('connection_id')
        .eq('id', msg.conversation_id)
        .maybeSingle();

      if (conv?.connection_id) {
        const { data: conn } = await supabase
          .from('whatsapp_connections')
          .select('meta_access_token, evolution_base_url, evolution_api_key, evolution_instance_name')
          .eq('id', conv.connection_id)
          .maybeSingle();

        if (conn) {
          settings = {
            meta_access_token: conn.meta_access_token,
            evolution_api_url: conn.evolution_base_url,
            evolution_api_key: conn.evolution_api_key,
            evolution_instance_name: conn.evolution_instance_name,
          };
        }
      }
    }

    if (!settings) {
      // Fallback legado: nina_settings (config única, pré multi-conexão)
      const { data: legacySettings } = await supabase
        .from('nina_settings')
        .select('meta_access_token, evolution_api_url, evolution_api_key, evolution_instance_name')
        .limit(1)
        .maybeSingle();
      settings = legacySettings;
    }

    if (!settings) {
      return new Response(JSON.stringify({ error: 'Nenhuma configuração de WhatsApp encontrada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const media = await getOrDownloadMedia(supabase, settings, mediaId);

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
