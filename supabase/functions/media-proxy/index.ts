import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get Meta access token from settings
    const { data: settings } = await supabase
      .from('nina_settings')
      .select('meta_access_token')
      .limit(1)
      .maybeSingle();

    if (!settings?.meta_access_token) {
      return new Response(JSON.stringify({ error: 'Meta access token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 1: Get media URL from Meta
    const mediaInfoRes = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${settings.meta_access_token}` }
    });

    if (!mediaInfoRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to get media info' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const mediaInfo = await mediaInfoRes.json();
    
    if (!mediaInfo.url) {
      return new Response(JSON.stringify({ error: 'No media URL returned' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Step 2: Download the actual media file from Meta
    const mediaRes = await fetch(mediaInfo.url, {
      headers: { 'Authorization': `Bearer ${settings.meta_access_token}` }
    });

    if (!mediaRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to download media' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';
    const mediaData = await mediaRes.arrayBuffer();

    return new Response(mediaData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
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
