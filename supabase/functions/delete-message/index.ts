import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveSendCredentials } from "../_shared/connection-resolver.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { response: authError } = await requireAuth(req, corsHeaders);
  if (authError) return authError;

  try {
    const { message_id } = await req.json();
    if (!message_id) {
      return new Response(JSON.stringify({ error: 'Missing message_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: message, error: msgError } = await supabase
      .from('messages')
      .select('id, conversation_id, from_type, whatsapp_message_id')
      .eq('id', message_id)
      .maybeSingle();

    if (msgError || !message) {
      return new Response(JSON.stringify({ error: 'Message not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: conversation } = await supabase
      .from('conversations')
      .select('api_source, connection_id, contact_id')
      .eq('id', message.conversation_id)
      .maybeSingle();

    let deletedOnWhatsapp = false;

    // Só é possível apagar do lado do cliente mensagens que NÓS enviamos,
    // via Evolution API — a Meta Cloud API não tem endpoint de "apagar
    // para todos" pra mensagens enviadas pelo negócio, e nenhuma API
    // (oficial ou não) deixa apagar do celular do cliente uma mensagem
    // que ele mesmo enviou.
    if (
      conversation &&
      conversation.api_source === 'evolution' &&
      message.from_type !== 'user' &&
      message.whatsapp_message_id
    ) {
      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('phone_number, whatsapp_id')
          .eq('id', conversation.contact_id)
          .maybeSingle();

        const credentials = await resolveSendCredentials(supabase, {
          connectionId: conversation.connection_id ?? null,
          apiSource: 'evolution',
        });

        const recipient = (contact?.whatsapp_id || contact?.phone_number || '')
          .replace('@s.whatsapp.net', '')
          .replace(/\D/g, '');

        const baseUrl = (credentials.evolution_api_url || '').replace(/\/$/, '');
        let apiKey = credentials.evolution_api_key || '';
        if (apiKey.includes('=')) {
          apiKey = apiKey.split('=').slice(1).join('=');
        }

        const response = await fetch(
          `${baseUrl}/chat/deleteMessageForEveryone/${credentials.evolution_instance_name}`,
          {
            method: 'DELETE',
            headers: { 'apikey': apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: message.whatsapp_message_id,
              remoteJid: `${recipient}@s.whatsapp.net`,
              fromMe: true,
            }),
          }
        );

        deletedOnWhatsapp = response.ok;
        if (!response.ok) {
          console.error('[DeleteMessage] Evolution delete-for-everyone failed:', await response.text());
        }
      } catch (err) {
        console.error('[DeleteMessage] Error trying to delete on WhatsApp (non-blocking):', err);
      }
    }

    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', message_id);

    if (deleteError) {
      console.error('[DeleteMessage] Error deleting message record:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete message' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, deletedOnWhatsapp }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[DeleteMessage] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
