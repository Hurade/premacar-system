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
    const { account_sid, auth_token } = await req.json();

    if (!account_sid || !auth_token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Campos obrigatórios: account_sid, auth_token',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[TestTwilioConnection] Testing account ${account_sid}`);

    const auth = btoa(`${account_sid}:${auth_token}`);
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${account_sid}.json`, {
      headers: { 'Authorization': `Basic ${auth}` },
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: data.message || `Twilio retornou status ${response.status}`,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      friendly_name: data.friendly_name,
      status: data.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[TestTwilioConnection] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
