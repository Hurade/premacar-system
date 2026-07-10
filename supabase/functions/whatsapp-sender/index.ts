import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveSendCredentials } from "../_shared/connection-resolver.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[Sender] Starting send process...');

    const MAX_EXECUTION_TIME = 25000; // 25 seconds
    const startTime = Date.now();
    let totalSent = 0;
    let iterations = 0;

    console.log('[Sender] Starting polling loop');

    // Cache de settings para evitar múltiplas queries
    const settingsCache: Record<string, any> = {};

    while (Date.now() - startTime < MAX_EXECUTION_TIME) {
      iterations++;
      console.log(`[Sender] Iteration ${iterations}, elapsed: ${Date.now() - startTime}ms`);

      // Claim batch of messages to send
      const { data: queueItems, error: claimError } = await supabase
        .rpc('claim_send_queue_batch', { p_limit: 10 });

      if (claimError) {
        console.error('[Sender] Error claiming batch:', claimError);
        throw claimError;
      }

      if (!queueItems || queueItems.length === 0) {
        console.log('[Sender] No messages ready to send, checking for scheduled messages...');
        
        const { data: upcoming, error: upcomingError } = await supabase
          .from('send_queue')
          .select('id, scheduled_at')
          .eq('status', 'pending')
          .gte('scheduled_at', new Date().toISOString())
          .lte('scheduled_at', new Date(Date.now() + 5000).toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(1);

        if (upcomingError) {
          console.error('[Sender] Error checking upcoming messages:', upcomingError);
        }

        if (upcoming && upcoming.length > 0) {
          const scheduledAt = new Date(upcoming[0].scheduled_at).getTime();
          const now = Date.now();
          const waitTime = Math.min(
            Math.max(scheduledAt - now + 100, 0),
            5000
          );
          
          if (waitTime > 0 && (Date.now() - startTime + waitTime) < MAX_EXECUTION_TIME) {
            console.log(`[Sender] Waiting ${waitTime}ms for scheduled message at ${upcoming[0].scheduled_at}`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }
        
        console.log('[Sender] No more messages to process, exiting loop');
        break;
      }

      console.log(`[Sender] Processing batch of ${queueItems.length} messages`);

      for (const item of queueItems) {
        try {
          // Usa connection_id gravado no próprio item (fila) quando existe;
          // senão cai no connection_id da conversa (ex: item antigo, enfileirado
          // antes desta mudança) — ver connection-resolver.ts
          const { data: conversation } = await supabase
            .from('conversations')
            .select('api_source, connection_id')
            .eq('id', item.conversation_id)
            .maybeSingle();

          const apiSource = conversation?.api_source || 'evolution';
          const connectionId = item.connection_id ?? conversation?.connection_id ?? null;
          console.log(`[Sender] Using ${apiSource} API (connection: ${connectionId ?? 'legado/global'}) for message ${item.id}`);

          // Get appropriate settings based on connection + API source
          const cacheKey = connectionId ?? apiSource;
          let settings = settingsCache[cacheKey];

          if (!settings) {
            settings = await resolveSendCredentials(supabase, { connectionId, apiSource });
            settingsCache[cacheKey] = settings;
          }

          await sendMessage(supabase, settings, item);
          
          // Mark as completed
          await supabase
            .from('send_queue')
            .update({ 
              status: 'completed', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', item.id);
          
          totalSent++;
          console.log(`[Sender] Successfully sent message ${item.id} via ${apiSource} (${totalSent} total)`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Sender] Error sending item ${item.id}:`, error);
          
          const newRetryCount = (item.retry_count || 0) + 1;
          const shouldRetry = newRetryCount < 3;
          
          await supabase
            .from('send_queue')
            .update({ 
              status: shouldRetry ? 'pending' : 'failed',
              retry_count: newRetryCount,
              error_message: errorMessage,
              scheduled_at: shouldRetry 
                ? new Date(Date.now() + newRetryCount * 15000).toISOString() // 15s, 30s backoff
                : null
            })
            .eq('id', item.id);
        }
      }
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Sender] Completed: sent ${totalSent} messages in ${iterations} iterations (${executionTime}ms)`);

    return new Response(JSON.stringify({ 
      sent: totalSent, 
      iterations,
      executionTime 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Sender] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function sendMessage(supabase: any, settings: any, queueItem: any) {
  console.log(`[Sender] Sending message: ${queueItem.id} via ${settings.api_type || 'evolution'}`);

  // Get contact phone number
  const { data: contact } = await supabase
    .from('contacts')
    .select('phone_number, whatsapp_id')
    .eq('id', queueItem.contact_id)
    .maybeSingle();

  if (!contact) {
    throw new Error('Contact not found');
  }

  // Clean phone number (remove @s.whatsapp.net if present)
  const recipient = (contact.whatsapp_id || contact.phone_number)
    .replace('@s.whatsapp.net', '')
    .replace(/\D/g, '');

  let whatsappMessageId = null;

  // Route to appropriate API
  if (settings.api_type === 'meta') {
    whatsappMessageId = await sendViaMeta(settings, recipient, queueItem);
  } else {
    whatsappMessageId = await sendViaEvolution(settings, recipient, queueItem);
  }

  console.log('[Sender] Message sent, ID:', whatsappMessageId);

  // Update or create message record in database
  if (queueItem.message_id) {
    console.log('[Sender] Updating existing message:', queueItem.message_id);
    const { error: msgError } = await supabase
      .from('messages')
      .update({
        whatsapp_message_id: whatsappMessageId,
        status: 'sent',
        sent_at: new Date().toISOString(),
        api_source: settings.api_type || 'evolution'
      })
      .eq('id', queueItem.message_id);

    if (msgError) {
      console.error('[Sender] Error updating message record:', msgError);
    }
  } else {
    console.log('[Sender] Creating new message record');
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: queueItem.conversation_id,
        whatsapp_message_id: whatsappMessageId,
        content: queueItem.content,
        type: queueItem.message_type,
        from_type: queueItem.from_type,
        status: 'sent',
        media_url: queueItem.media_url || null,
        api_source: settings.api_type || 'evolution',
        sent_at: new Date().toISOString(),
        metadata: queueItem.metadata || {}
      });

    if (msgError) {
      console.error('[Sender] Error creating message record:', msgError);
    }
  }

  // Update conversation last_message_at
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', queueItem.conversation_id);
}

// Send via Meta WhatsApp Business API
async function sendViaMeta(settings: any, recipient: string, queueItem: any): Promise<string | null> {
  const url = `https://graph.facebook.com/v18.0/${settings.meta_phone_number_id}/messages`;
  
  let payload: any;

  switch (queueItem.message_type) {
    case 'text':
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { body: queueItem.content }
      };
      break;
    
    case 'image':
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'image',
        image: {
          link: queueItem.media_url,
          caption: queueItem.content || undefined
        }
      };
      break;
    
    case 'audio':
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'audio',
        audio: { link: queueItem.media_url }
      };
      break;
    
    case 'document':
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'document',
        document: {
          link: queueItem.media_url,
          filename: queueItem.content || 'document'
        }
      };
      break;
    
    default:
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: { body: queueItem.content }
      };
  }

  console.log('[Sender] Meta API request:', { url, payload });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.meta_access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error('[Sender] Meta API error:', responseData);
    throw new Error(responseData.error?.message || 'Meta API error');
  }

  return responseData.messages?.[0]?.id || null;
}

// Send via Evolution API with automatic retry for transient errors
async function sendViaEvolution(settings: any, recipient: string, queueItem: any): Promise<string | null> {
  // Clean Evolution API URL (remove trailing slash)
  const baseUrl = settings.evolution_api_url.replace(/\/$/, '');

  // Build Evolution API request based on message type
  let endpoint = '';
  let payload: any = {};

  switch (queueItem.message_type) {
    case 'text':
      endpoint = `/message/sendText/${settings.evolution_instance_name}`;
      payload = { number: recipient, text: queueItem.content };
      break;
    case 'image':
      endpoint = `/message/sendMedia/${settings.evolution_instance_name}`;
      payload = { number: recipient, mediatype: 'image', media: queueItem.media_url, caption: queueItem.content || undefined };
      break;
    case 'audio':
      endpoint = `/message/sendMedia/${settings.evolution_instance_name}`;
      payload = { number: recipient, mediatype: 'audio', media: queueItem.media_url };
      break;
    case 'document':
      endpoint = `/message/sendMedia/${settings.evolution_instance_name}`;
      payload = { number: recipient, mediatype: 'document', media: queueItem.media_url, fileName: queueItem.content || 'document' };
      break;
    default:
      endpoint = `/message/sendText/${settings.evolution_instance_name}`;
      payload = { number: recipient, text: queueItem.content };
  }

  // Clean Evolution API key
  let apiKey = settings.evolution_api_key || '';
  if (apiKey.includes('=')) {
    apiKey = apiKey.split('=').slice(1).join('=');
  }

  const url = `${baseUrl}${endpoint}`;
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [2000, 4000, 8000]; // 2s, 4s, 8s backoff

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[Sender] Evolution API request (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, { url, payload });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMsg = JSON.stringify(responseData);
        const isConnectionClosed = errorMsg.toLowerCase().includes('connection closed') || 
                                    errorMsg.toLowerCase().includes('connection reset') ||
                                    errorMsg.toLowerCase().includes('econnrefused') ||
                                    errorMsg.toLowerCase().includes('timeout') ||
                                    response.status === 502 || 
                                    response.status === 503;

        if (isConnectionClosed && attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt];
          console.warn(`[Sender] Evolution transient error (attempt ${attempt + 1}), retrying in ${delay}ms:`, responseData);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        console.error('[Sender] Evolution API error (final):', responseData);
        throw new Error(responseData.message || responseData.error || 'Evolution API error');
      }

      if (attempt > 0) {
        console.log(`[Sender] Evolution API succeeded on retry attempt ${attempt + 1}`);
      }

      return responseData.key?.id || responseData.messageId || null;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      const isTransient = errMsg.toLowerCase().includes('connection') || 
                          errMsg.toLowerCase().includes('timeout') ||
                          errMsg.toLowerCase().includes('fetch failed');

      if (isTransient && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[Sender] Evolution fetch error (attempt ${attempt + 1}), retrying in ${delay}ms:`, errMsg);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw new Error('Evolution API: max retries exceeded');
}
