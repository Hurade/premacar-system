import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_GROUPING_DELAY_MS = 20000;

// Validate Meta webhook signature
function validateMetaSignature(body: string, signature: string | null, appSecret: string): boolean {
  if (!signature || !appSecret) {
    console.warn('[Meta Webhook] Missing signature or app secret');
    return false;
  }
  
  const expectedSignature = 'sha256=' + createHmac('sha256', appSecret)
    .update(body)
    .digest('hex');
  
  return signature === expectedSignature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // GET request = Webhook verification from Meta
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('[Meta Webhook] Verification request:', { mode, token: token?.substring(0, 10) + '...' });

      if (mode === 'subscribe' && token && challenge) {
        // Get verify token from settings
        const { data: settings } = await supabase
          .from('nina_settings')
          .select('whatsapp_verify_token')
          .eq('meta_api_enabled', true)
          .limit(1)
          .maybeSingle();

        const verifyToken = settings?.whatsapp_verify_token || 'meta-webhook-verify';

        if (token === verifyToken) {
          console.log('[Meta Webhook] Verification successful');
          return new Response(challenge, { status: 200, headers: corsHeaders });
        }
        
        console.warn('[Meta Webhook] Token mismatch');
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }

      return new Response(JSON.stringify({ status: 'ok', api: 'meta' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // POST request = Incoming message from Meta
    if (req.method === 'POST') {
      const rawBody = await req.text();
      const body = JSON.parse(rawBody);
      
      console.log('[Meta Webhook] Received payload:', JSON.stringify(body, null, 2));

      // Get Meta settings
      const { data: metaSettings } = await supabase
        .from('nina_settings')
        .select('*')
        .eq('meta_api_enabled', true)
        .limit(1)
        .maybeSingle();

      if (!metaSettings) {
        console.warn('[Meta Webhook] Meta API not enabled');
        return new Response(JSON.stringify({ status: 'meta_not_enabled' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Validate signature (optional but recommended)
      const signature = req.headers.get('x-hub-signature-256');
      if (metaSettings.meta_app_secret && signature) {
        const isValid = validateMetaSignature(rawBody, signature, metaSettings.meta_app_secret);
        if (!isValid) {
          console.warn('[Meta Webhook] Invalid signature');
          return new Response('Invalid signature', { status: 401, headers: corsHeaders });
        }
      }

      const groupingEnabled = metaSettings.message_grouping_enabled !== false;
      const groupingDelay = metaSettings.message_grouping_delay || DEFAULT_GROUPING_DELAY_MS;
      const ownerId = metaSettings.user_id;

      // Process Meta webhook structure
      const entry = body.entry?.[0];
      if (!entry) {
        console.log('[Meta Webhook] No entry in payload');
        return new Response(JSON.stringify({ status: 'no_entry' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const changes = entry.changes?.[0];
      const value = changes?.value;

      if (!value) {
        console.log('[Meta Webhook] No value in changes');
        return new Response(JSON.stringify({ status: 'no_value' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Handle message status updates
      if (value.statuses) {
        for (const status of value.statuses) {
          const messageId = status.id;
          const statusType = status.status; // sent, delivered, read, failed
          
          console.log(`[Meta Webhook] Status update: ${messageId} -> ${statusType}`);
          
          // Update message status in database
          const updateData: any = {};
          if (statusType === 'delivered') {
            updateData.status = 'delivered';
            updateData.delivered_at = new Date().toISOString();
          } else if (statusType === 'read') {
            updateData.status = 'read';
            updateData.read_at = new Date().toISOString();
          } else if (statusType === 'failed') {
            updateData.status = 'failed';
          }
          
          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('messages')
              .update(updateData)
              .eq('whatsapp_message_id', messageId);
          }
        }
        
        return new Response(JSON.stringify({ status: 'status_processed' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Handle incoming messages
      if (value.messages) {
        for (const message of value.messages) {
          const phoneNumber = message.from;
          const messageId = message.id;
          const messageType = message.type;
          const timestamp = parseInt(message.timestamp) * 1000;
          
          // Get contact info from contacts array
          const contactInfo = value.contacts?.find((c: any) => c.wa_id === phoneNumber);
          const contactName = contactInfo?.profile?.name || null;
          
          console.log(`[Meta Webhook] Processing message from ${phoneNumber} (${contactName})`);

          // Extract message content based on type
          let messageContent = '';
          let dbMessageType = 'text';
          let mediaType = null;
          let mediaUrl = null;

          switch (messageType) {
            case 'text':
              messageContent = message.text?.body || '';
              dbMessageType = 'text';
              break;
            case 'image':
              messageContent = message.image?.caption || '[imagem recebida]';
              dbMessageType = 'image';
              mediaType = 'image';
              mediaUrl = message.image?.id; // Media ID for download
              break;
            case 'audio':
              messageContent = '[áudio recebido]';
              dbMessageType = 'audio';
              mediaType = 'audio';
              mediaUrl = message.audio?.id;
              break;
            case 'video':
              messageContent = message.video?.caption || '[vídeo recebido]';
              dbMessageType = 'video';
              mediaType = 'video';
              mediaUrl = message.video?.id;
              break;
            case 'document':
              messageContent = message.document?.filename || '[documento recebido]';
              dbMessageType = 'document';
              mediaType = 'document';
              mediaUrl = message.document?.id;
              break;
            case 'button':
              messageContent = message.button?.text || '[botão clicado]';
              dbMessageType = 'text';
              break;
            case 'interactive':
              const interactive = message.interactive;
              messageContent = interactive?.button_reply?.title || 
                              interactive?.list_reply?.title || 
                              '[resposta interativa]';
              dbMessageType = 'text';
              break;
            default:
              messageContent = '[mensagem não suportada]';
          }

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
                whatsapp_id: phoneNumber,
                name: contactName,
                call_name: contactName?.split(' ')[0] || null,
                user_id: null
              })
              .select()
              .single();

            if (contactError) {
              console.error('[Meta Webhook] Error creating contact:', contactError);
              continue;
            }
            contact = newContact;
            console.log('[Meta Webhook] Created new contact:', contact.id);
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

          // 2. Get or create conversation with api_source = 'meta'
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
                api_source: 'meta', // Mark as Meta API conversation
                user_id: null
              })
              .select()
              .single();

            if (convError) {
              console.error('[Meta Webhook] Error creating conversation:', convError);
              continue;
            }
            conversation = newConversation;
            console.log('[Meta Webhook] Created new conversation:', conversation.id);
          } else if (conversation.api_source !== 'meta') {
            // Update existing conversation to Meta source
            await supabase
              .from('conversations')
              .update({ api_source: 'meta' })
              .eq('id', conversation.id);
          }

          // 3. Create message with api_source
          const { data: dbMessage, error: msgError } = await supabase
            .from('messages')
            .insert({
              conversation_id: conversation.id,
              whatsapp_message_id: messageId,
              content: messageContent,
              type: dbMessageType,
              from_type: 'user',
              status: 'sent',
              media_type: mediaType,
              media_url: mediaUrl,
              api_source: 'meta',
              sent_at: new Date(timestamp).toISOString(),
              metadata: { 
                original_type: messageType,
                meta_phone_number_id: metaSettings.meta_phone_number_id
              }
            })
            .select()
            .single();

          if (msgError) {
            if (msgError.code === '23505') {
              console.log('[Meta Webhook] Duplicate message ignored:', messageId);
              continue;
            }
            console.error('[Meta Webhook] Error creating message:', msgError);
            continue;
          }

          console.log('[Meta Webhook] Created message:', dbMessage.id);

          // 4. Update conversation last_message_at
          await supabase
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversation.id);

          // 5. Queue for AI processing (same logic as Evolution)
          if (!groupingEnabled) {
            // Process immediately
            if (conversation.status === 'nina') {
              await supabase
                .from('nina_processing_queue')
                .insert({
                  message_id: dbMessage.id,
                  conversation_id: conversation.id,
                  contact_id: contact.id,
                  priority: 1,
                  context_data: {
                    phone_number_id: metaSettings.meta_phone_number_id,
                    contact_name: contactName,
                    message_type: dbMessageType,
                    grouped_count: 1,
                    combined_content: messageContent,
                    api_source: 'meta'
                  }
                });

              EdgeRuntime.waitUntil(
                fetch(`${supabaseUrl}/functions/v1/nina-orchestrator`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`
                  },
                  body: JSON.stringify({ triggered_by: 'meta-webhook-immediate' })
                }).catch(err => console.error('[Meta Webhook] Error triggering nina:', err))
              );
            }
          } else {
            // Use grouping queue
            const processAfter = new Date(Date.now() + groupingDelay).toISOString();
            
            // Extend timer for existing messages
            await supabase
              .from('message_grouping_queue')
              .update({ process_after: processAfter })
              .eq('processed', false)
              .filter('message_data->>from', 'eq', phoneNumber);

            await supabase
              .from('message_grouping_queue')
              .insert({
                whatsapp_message_id: messageId,
                phone_number_id: metaSettings.meta_phone_number_id,
                message_id: dbMessage.id,
                message_data: { 
                  from: phoneNumber,
                  type: dbMessageType,
                  api_source: 'meta'
                },
                contacts_data: { 
                  profile: { name: contactName },
                  wa_id: phoneNumber 
                },
                process_after: processAfter
              });

            EdgeRuntime.waitUntil(
              fetch(`${supabaseUrl}/functions/v1/message-grouper`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify({ triggered_by: 'meta-webhook' })
              }).catch(err => console.error('[Meta Webhook] Error triggering grouper:', err))
            );
          }
        }

        return new Response(JSON.stringify({ status: 'processed' }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Acknowledge any other webhook events
      return new Response(JSON.stringify({ status: 'acknowledged' }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('[Meta Webhook] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});
