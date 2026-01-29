import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GROUPING_DELAY_MS = 10000; // 10 seconds

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // GET request = Webhook verification (not needed for Evolution, but keep for compatibility)
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      // Legacy Meta verification - keep for backwards compatibility
      if (mode === 'subscribe' && token && challenge) {
        const { data: settings } = await supabase
          .from('nina_settings')
          .select('whatsapp_verify_token')
          .not('whatsapp_verify_token', 'is', null)
          .limit(1)
          .maybeSingle();

        const verifyToken = settings?.whatsapp_verify_token || 'webhook-verify-token';

        if (token === verifyToken) {
          console.log('[Webhook] Legacy Meta verification successful');
          return new Response(challenge, { status: 200, headers: corsHeaders });
        }
      }

      // Evolution API health check
      console.log('[Webhook] Health check OK');
      return new Response(JSON.stringify({ status: 'ok', api: 'evolution' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // POST request = Incoming message from Evolution API
    if (req.method === 'POST') {
      const body = await req.json();
      console.log('[Webhook] Received Evolution API payload:', JSON.stringify(body, null, 2));

      // Evolution API format
      const event = body.event;
      const instanceName = body.instance;
      const data = body.data;

      // Handle different Evolution events
      if (event === 'connection.update') {
        console.log('[Webhook] Connection update:', data?.state);
        return new Response(JSON.stringify({ status: 'connection_update_received' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Only process messages.upsert events
      if (event !== 'messages.upsert') {
        console.log('[Webhook] Ignoring event:', event);
        return new Response(JSON.stringify({ status: 'ignored', event }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      if (!data) {
        console.log('[Webhook] No data in payload, ignoring');
        return new Response(JSON.stringify({ status: 'ignored' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Find the user who owns this Evolution instance
      const { data: ownerSettings } = await supabase
        .from('nina_settings')
        .select('user_id, evolution_api_url, evolution_api_key')
        .eq('evolution_instance_name', instanceName)
        .maybeSingle();

      let ownerId = ownerSettings?.user_id || null;
      
      // Fallback to system admin if no specific owner
      if (!ownerId) {
        console.log('[Webhook] No owner for instance, looking for system admin...');
        const { data: adminRole } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'admin')
          .limit(1)
          .maybeSingle();
        
        ownerId = adminRole?.user_id || null;
      }

      // Skip messages from self (fromMe = true)
      if (data.key?.fromMe) {
        console.log('[Webhook] Skipping message from self');
        return new Response(JSON.stringify({ status: 'ignored_from_me' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Extract phone number from remoteJid (format: 5511999999999@s.whatsapp.net)
      const remoteJid = data.key?.remoteJid;
      if (!remoteJid || remoteJid.includes('@g.us')) {
        console.log('[Webhook] Ignoring group message or invalid jid');
        return new Response(JSON.stringify({ status: 'ignored_group' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const phoneNumber = remoteJid.replace('@s.whatsapp.net', '');
      const contactName = data.pushName || null;
      const messageId = data.key?.id;
      const messageTimestamp = data.messageTimestamp || Math.floor(Date.now() / 1000);

      console.log(`[Webhook] Processing message from ${phoneNumber} (${contactName})`);

      // 1. Get or create contact
      let { data: contact } = await supabase
        .from('contacts')
        .select('*')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (!contact) {
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            phone_number: phoneNumber,
            whatsapp_id: remoteJid,
            name: contactName,
            call_name: contactName?.split(' ')[0] || null,
            user_id: null
          })
          .select()
          .single();

        if (contactError) {
          console.error('[Webhook] Error creating contact:', contactError);
          return new Response(JSON.stringify({ error: 'Failed to create contact' }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        contact = newContact;
        console.log('[Webhook] Created new contact:', contact.id);
      } else {
        // Update contact activity
        const updates: any = { last_activity: new Date().toISOString() };
        if (contactName && !contact.name) {
          updates.name = contactName;
          updates.call_name = contactName.split(' ')[0];
        }
        
        await supabase
          .from('contacts')
          .update(updates)
          .eq('id', contact.id);
      }

      // 2. Get or create conversation
      let { data: conversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!conversation) {
        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contact.id,
            status: 'nina',
            is_active: true,
            user_id: null
          })
          .select()
          .single();

        if (convError) {
          console.error('[Webhook] Error creating conversation:', convError);
          return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        conversation = newConversation;
        console.log('[Webhook] Created new conversation:', conversation.id);
      }

      // 3. Determine message content and type
      let messageContent = '';
      let messageType = 'text';
      let mediaType = null;
      let mediaId = null;

      const msg = data.message;
      if (msg?.conversation) {
        messageContent = msg.conversation;
        messageType = 'text';
      } else if (msg?.extendedTextMessage?.text) {
        messageContent = msg.extendedTextMessage.text;
        messageType = 'text';
      } else if (msg?.imageMessage) {
        messageContent = msg.imageMessage.caption || '[imagem recebida]';
        messageType = 'image';
        mediaType = 'image';
        mediaId = msg.imageMessage.mediaKey;
      } else if (msg?.audioMessage) {
        messageContent = '[áudio - processando transcrição...]';
        messageType = 'audio';
        mediaType = 'audio';
        mediaId = msg.audioMessage.mediaKey;
      } else if (msg?.videoMessage) {
        messageContent = msg.videoMessage.caption || '[vídeo recebido]';
        messageType = 'video';
        mediaType = 'video';
        mediaId = msg.videoMessage.mediaKey;
      } else if (msg?.documentMessage) {
        messageContent = msg.documentMessage.fileName || '[documento recebido]';
        messageType = 'document';
        mediaType = 'document';
        mediaId = msg.documentMessage.mediaKey;
      } else {
        messageContent = '[mensagem não suportada]';
      }

      // 4. Create message
      const { data: dbMessage, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversation.id,
          whatsapp_message_id: messageId,
          content: messageContent,
          type: messageType,
          from_type: 'user',
          status: 'sent',
          media_type: mediaType,
          sent_at: new Date(messageTimestamp * 1000).toISOString(),
          metadata: { 
            original_type: messageType,
            media_id: mediaId,
            evolution_instance: instanceName
          }
        })
        .select()
        .single();

      if (msgError) {
        if (msgError.code === '23505') {
          console.log('[Webhook] Duplicate message ignored:', messageId);
          return new Response(JSON.stringify({ status: 'duplicate' }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
        console.error('[Webhook] Error creating message:', msgError);
        return new Response(JSON.stringify({ error: 'Failed to create message' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log('[Webhook] Created message:', dbMessage.id);

      // 5. Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);

      // 6. Queue for message grouping
      const processAfter = new Date(Date.now() + GROUPING_DELAY_MS).toISOString();

      await supabase
        .from('message_grouping_queue')
        .update({ process_after: processAfter })
        .eq('processed', false)
        .filter('message_data->>from', 'eq', phoneNumber);

      const { error: queueError } = await supabase
        .from('message_grouping_queue')
        .insert({
          whatsapp_message_id: messageId,
          phone_number_id: instanceName, // Using instance name as identifier
          message_id: dbMessage.id,
          message_data: { 
            ...data, 
            from: phoneNumber,
            type: messageType 
          },
          contacts_data: { 
            profile: { name: contactName },
            wa_id: phoneNumber 
          },
          process_after: processAfter
        });

      if (queueError && queueError.code !== '23505') {
        console.error('[Webhook] Queue insert error:', queueError);
      } else {
        console.log('[Webhook] Message queued:', messageId);
      }

      // Trigger message-grouper in background
      EdgeRuntime.waitUntil(
        fetch(`${supabaseUrl}/functions/v1/message-grouper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({ triggered_by: 'whatsapp-webhook' })
        }).catch(err => console.error('[Webhook] Error triggering message-grouper:', err))
      );

      return new Response(JSON.stringify({ status: 'processed', message_id: dbMessage.id }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('[Webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
