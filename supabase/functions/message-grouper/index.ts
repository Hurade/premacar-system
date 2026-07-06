import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { downloadMedia, transcribeAudio, describeImage, extractPdfText } from "../_shared/media.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Placeholders salvos pelos webhooks (Meta/Evolution) enquanto a mídia não é resolvida
const MEDIA_PLACEHOLDERS = [
  '[áudio - processando transcrição...]',
  '[áudio recebido]',
  '[imagem recebida]',
  '[documento recebido]',
  '[vídeo recebido]',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('[MessageGrouper] Starting message grouping...');

    // Fetch messages ready to process (timer expired and not processed)
    const { data: readyMessages, error: fetchError } = await supabase
      .from('message_grouping_queue')
      .select('*')
      .eq('processed', false)
      .lte('process_after', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('[MessageGrouper] Error fetching messages:', fetchError);
      throw fetchError;
    }

    if (!readyMessages || readyMessages.length === 0) {
      console.log('[MessageGrouper] No messages ready to process');
      
      // Check if there are pending messages with future process_after and schedule re-invocation
      await scheduleNextProcessing(supabase, supabaseUrl, supabaseServiceKey);
      
      return new Response(JSON.stringify({ processed: 0, groups: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[MessageGrouper] Found ${readyMessages.length} messages ready to process`);

    // IMMEDIATELY mark all ready messages as processed to prevent duplicates
    const readyIds = readyMessages.map(m => m.id);
    await supabase
      .from('message_grouping_queue')
      .update({ processed: true })
      .in('id', readyIds);

    console.log(`[MessageGrouper] Marked ${readyIds.length} messages as processed`);

    // Group messages by phone number
    const grouped: Record<string, typeof readyMessages> = {};
    for (const msg of readyMessages) {
      const phone = msg.message_data?.from;
      if (!phone) continue;
      if (!grouped[phone]) grouped[phone] = [];
      grouped[phone].push(msg);
    }

    const groupCount = Object.keys(grouped).length;
    console.log(`[MessageGrouper] Grouped into ${groupCount} phone numbers`);

    let processedCount = 0;

    // Process each group
    for (const [phoneNumber, messages] of Object.entries(grouped)) {
      try {
        console.log(`[MessageGrouper] ========================================`);
        console.log(`[MessageGrouper] Processing group for ${phoneNumber}`);
        console.log(`[MessageGrouper] Total messages in group: ${messages.length}`);

        // Get the phone_number_id from the first message
        const phoneNumberId = messages[0].phone_number_id;

        // Get owner settings for this instance (include meta tokens for audio transcription)
        let ownerSettings = null;
        
        // Try by evolution instance name first
        const { data: evoSettings } = await supabase
          .from('nina_settings')
          .select('user_id, evolution_api_url, evolution_api_key, evolution_instance_name, meta_access_token, whatsapp_access_token')
          .eq('evolution_instance_name', phoneNumberId)
          .maybeSingle();
        
        if (evoSettings) {
          ownerSettings = evoSettings;
        } else {
          // Fallback: try by meta_phone_number_id (for Meta API messages)
          const { data: metaSettings } = await supabase
            .from('nina_settings')
            .select('user_id, evolution_api_url, evolution_api_key, evolution_instance_name, meta_access_token, whatsapp_access_token')
            .eq('meta_phone_number_id', phoneNumberId)
            .maybeSingle();
          
          if (metaSettings) {
            ownerSettings = metaSettings;
          } else {
            // Last fallback: any settings
            const { data: anySettings } = await supabase
              .from('nina_settings')
              .select('user_id, evolution_api_url, evolution_api_key, evolution_instance_name, meta_access_token, whatsapp_access_token')
              .limit(1)
              .maybeSingle();
            ownerSettings = anySettings;
          }
        }

        // Get all message_ids from the queue entries
        const messageIds = messages.map(m => m.message_id).filter(Boolean);
        
        if (messageIds.length === 0) {
          console.log(`[MessageGrouper] No message_ids found for group ${phoneNumber}, skipping`);
          continue;
        }

        // Fetch the actual messages from the database
        const { data: dbMessages, error: dbMsgError } = await supabase
          .from('messages')
          .select('*')
          .in('id', messageIds)
          .order('sent_at', { ascending: true });

        if (dbMsgError || !dbMessages || dbMessages.length === 0) {
          console.error('[MessageGrouper] Error fetching messages from DB:', dbMsgError);
          continue;
        }

        // Get the last message's conversation for context
        const lastDbMessage = dbMessages[dbMessages.length - 1];
        const conversationId = lastDbMessage.conversation_id;

        // Get conversation details
        const { data: conversation } = await supabase
          .from('conversations')
          .select('*, contacts(*)')
          .eq('id', conversationId)
          .single();

        if (!conversation) {
          console.error('[MessageGrouper] Conversation not found:', conversationId);
          continue;
        }

        // Combine content and handle audio transcription
        const combinedContent = await combineAndTranscribeMessages(
          supabase,
          messages,
          dbMessages,
          ownerSettings,
          lovableApiKey
        );

        console.log(`[MessageGrouper] ----------------------------------------`);
        console.log(`[MessageGrouper] Combined ${dbMessages.length} messages into single context`);
        console.log(`[MessageGrouper] Combined content preview:`, combinedContent.substring(0, 300));
        console.log(`[MessageGrouper] Full combined content:`, combinedContent);
        console.log(`[MessageGrouper] ----------------------------------------`);

        // Update the last message with combined content if multiple messages
        if (dbMessages.length > 1) {
          await supabase
            .from('messages')
            .update({
              content: combinedContent,
              metadata: {
                ...lastDbMessage.metadata,
                grouped_messages: messageIds,
                message_count: messageIds.length
              }
            })
            .eq('id', lastDbMessage.id);
          
          console.log(`[MessageGrouper] Updated last message with combined content`);
        } else if (['audio', 'image', 'document'].includes(dbMessages[0].type) && combinedContent !== dbMessages[0].content) {
          // Update single media message with the resolved content (transcrição/descrição/texto extraído)
          await supabase
            .from('messages')
            .update({ content: combinedContent })
            .eq('id', dbMessages[0].id);

          console.log(`[MessageGrouper] Updated ${dbMessages[0].type} message with resolved content`);
        }

        // If conversation is handled by Nina, queue for AI processing
        if (conversation.status === 'nina') {
          // Insert into queue - unique index prevents duplicates from race conditions
          const { error: ninaQueueError } = await supabase
            .from('nina_processing_queue')
            .insert({
              message_id: lastDbMessage.id,
              conversation_id: conversationId,
              contact_id: conversation.contact_id,
              priority: 1,
              context_data: {
                phone_number_id: phoneNumberId,
                contact_name: conversation.contacts?.name || conversation.contacts?.call_name,
                message_type: lastDbMessage.type,
                grouped_count: messageIds.length,
                combined_content: combinedContent
              }
            });

          if (ninaQueueError) {
            if (ninaQueueError.code === '23505') {
              // Unique constraint violation = duplicate, safe to ignore
              console.log('[MessageGrouper] Message already in Nina queue (duplicate prevented by constraint)');
            } else {
              console.error('[MessageGrouper] Error queuing for Nina:', ninaQueueError);
            }
          } else {
            console.log('[MessageGrouper] Message queued for Nina processing');
            
            // Trigger nina-orchestrator
            fetch(`${supabaseUrl}/functions/v1/nina-orchestrator`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({ triggered_by: 'message-grouper' })
            }).catch(err => console.error('[MessageGrouper] Error triggering nina-orchestrator:', err));
          }
        }

        processedCount += messages.length;
        console.log(`[MessageGrouper] ✓ Group ${phoneNumber} processed successfully (${messages.length} messages combined)`);
        console.log(`[MessageGrouper] ========================================`);

      } catch (groupError) {
        console.error(`[MessageGrouper] Error processing group ${phoneNumber}:`, groupError);
      }
    }

    console.log(`[MessageGrouper] Completed. Processed ${processedCount} messages in ${groupCount} groups`);

    // Check if there are more pending messages and schedule re-invocation
    await scheduleNextProcessing(supabase, supabaseUrl, supabaseServiceKey);

    return new Response(JSON.stringify({ 
      processed: processedCount, 
      groups: groupCount 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[MessageGrouper] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Combine content from multiple messages, resolvendo mídia (áudio/imagem/documento)
async function combineAndTranscribeMessages(
  supabase: any,
  queueMessages: any[],
  dbMessages: any[],
  settings: any,
  lovableApiKey: string
): Promise<string> {
  const contentParts: string[] = [];

  // Aceita tanto meta_access_token quanto whatsapp_access_token (nomes usados
  // em diferentes pontos do schema para a mesma credencial da Meta API).
  const accessToken = settings?.meta_access_token || settings?.whatsapp_access_token;
  const mediaSettings = { ...settings, meta_access_token: accessToken };

  for (let i = 0; i < queueMessages.length; i++) {
    const queueMsg = queueMessages[i];
    const dbMsg = dbMessages.find(m => m.id === queueMsg.message_id);

    if (!dbMsg) continue;

    let content = dbMsg.content || '';

    // Resolve mídia com base na própria mensagem salva (media_url + type),
    // não no payload do webhook — funciona igual para Meta e Evolution.
    if (dbMsg.media_url && ['audio', 'image', 'document'].includes(dbMsg.type) && lovableApiKey) {
      console.log(`[MessageGrouper] Resolvendo mídia (${dbMsg.type}):`, dbMsg.media_url);
      const mediaBuffer = await downloadMedia(mediaSettings, dbMsg.media_url);

      if (mediaBuffer && mediaBuffer.byteLength > 0) {
        let resolved: string | null = null;
        if (dbMsg.type === 'audio') {
          resolved = await transcribeAudio(mediaBuffer, lovableApiKey);
        } else if (dbMsg.type === 'image') {
          resolved = await describeImage(mediaBuffer, 'image/jpeg', lovableApiKey, dbMsg.content);
        } else if (dbMsg.type === 'document') {
          resolved = await extractPdfText(mediaBuffer);
        }

        if (resolved) {
          content = resolved;
          await supabase
            .from('messages')
            .update({ content: resolved })
            .eq('id', dbMsg.id);
        }
      }
    }

    if (content && !MEDIA_PLACEHOLDERS.includes(content)) {
      contentParts.push(content);
    }
  }

  return contentParts.join('\n');
}

// Schedule next processing if there are pending messages with future process_after
async function scheduleNextProcessing(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string
): Promise<void> {
  try {
    // Check for pending messages with future process_after
    const { data: pendingMessages, error } = await supabase
      .from('message_grouping_queue')
      .select('id, process_after')
      .eq('processed', false)
      .gt('process_after', new Date().toISOString())
      .order('process_after', { ascending: true })
      .limit(1);

    if (error) {
      console.error('[MessageGrouper] Error checking pending messages:', error);
      return;
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      console.log('[MessageGrouper] No pending messages to schedule');
      return;
    }

    const nextProcessAt = new Date(pendingMessages[0].process_after);
    const now = Date.now();
    const delayMs = Math.max(nextProcessAt.getTime() - now + 500, 1000); // +500ms buffer, min 1s
    
    // Cap delay at 30 seconds to prevent edge function timeout issues
    const cappedDelayMs = Math.min(delayMs, 30000);

    console.log(`[MessageGrouper] Scheduling self-invocation in ${cappedDelayMs}ms for pending message ${pendingMessages[0].id}`);

    // Use EdgeRuntime.waitUntil for background task
    (globalThis as any).EdgeRuntime?.waitUntil?.(
      new Promise<void>((resolve) => {
        setTimeout(async () => {
          try {
            console.log('[MessageGrouper] Self-invoking after scheduled delay');
            await fetch(`${supabaseUrl}/functions/v1/message-grouper`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`
              },
              body: JSON.stringify({ triggered_by: 'self-reschedule' })
            });
            console.log('[MessageGrouper] Self-invocation completed');
          } catch (err) {
            console.error('[MessageGrouper] Self-reschedule error:', err);
          }
          resolve();
        }, cappedDelayMs);
      })
    );
  } catch (error) {
    console.error('[MessageGrouper] Error scheduling next processing:', error);
  }
}
