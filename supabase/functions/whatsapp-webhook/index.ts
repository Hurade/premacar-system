import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { triggerNinaOrchestrator } from "../_shared/trigger-orchestrator.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ═══════════════════════════════════════════
// HMAC-SHA256 signature validation
// Set EVOLUTION_WEBHOOK_SECRET in Supabase secrets to enable.
// Evolution API must be configured with the same secret.
// ═══════════════════════════════════════════
async function verifyHmacSha256(secret: string, payload: string, signature: string): Promise<boolean> {
  if (!secret || !signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const computed = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  // Timing-safe comparison to prevent timing attacks
  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

const DEFAULT_GROUPING_DELAY_MS = 20000; // 20 seconds default

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
      const rawBody = await req.text();

      // HMAC validation. Quando EVOLUTION_WEBHOOK_SECRET está definido a
      // assinatura é obrigatória; sem o secret, aceitamos apenas payloads de
      // instâncias já cadastradas em whatsapp_connections/nina_settings.
      const webhookSecret = Deno.env.get('EVOLUTION_WEBHOOK_SECRET');
      if (webhookSecret) {
        const signature =
          req.headers.get('x-signature') ??
          req.headers.get('x-hub-signature-256')?.replace(/^sha256=/, '') ??
          '';
        const valid = await verifyHmacSha256(webhookSecret, rawBody, signature);
        if (!valid) {
          console.warn('[Webhook] ❌ Assinatura HMAC inválida — requisição rejeitada');
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        console.log('[Webhook] ✅ Assinatura HMAC válida');
      }

      const body = JSON.parse(rawBody);
      console.log('[Webhook] Received Evolution API payload:', JSON.stringify(body, null, 2));

      // Evolution API format
      const event = body.event;
      const instanceName = body.instance;
      const data = body.data;

      if (!webhookSecret) {
        // Fallback anti-spoofing: a instância precisa existir na configuração
        const [{ data: knownConn }, { data: ninaConn }] = await Promise.all([
          supabase
            .from('whatsapp_connections')
            .select('id')
            .eq('evolution_instance_name', instanceName ?? '')
            .maybeSingle(),
          supabase
            .from('nina_settings')
            .select('evolution_instance_name')
            .eq('evolution_instance_name', instanceName ?? '')
            .maybeSingle(),
        ]);

        if (!instanceName || (!knownConn && !ninaConn)) {
          console.warn('[Webhook] ❌ Instância desconhecida — requisição rejeitada:', instanceName);
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }


      // Handle different Evolution events
      if (event === 'qrcode.updated') {
        // Evolution v2 manda o QR em data.qrcode.base64 ou data.base64
        const base64 = data?.qrcode?.base64 || data?.base64 || null;
        console.log('[Webhook] QR updated for instance:', instanceName, 'has base64:', !!base64);
        if (base64) {
          const expiresAt = new Date(Date.now() + 60_000).toISOString();
          const { error: qrErr } = await supabase
            .from('whatsapp_connections')
            .update({ qr_code: base64, qr_code_expires_at: expiresAt, is_connected: false })
            .eq('evolution_instance_name', instanceName);
          if (qrErr) console.error('[Webhook] Error saving QR:', qrErr);
        }
        return new Response(JSON.stringify({ status: 'qrcode_saved' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (event === 'connection.update') {
        const state = data?.state || data?.connection || 'unknown';
        console.log('[Webhook] Connection update:', state, 'instance:', instanceName);
        if (state === 'open') {
          // Conectou — marca conectado e limpa o QR (já não serve)
          const { error: connErr } = await supabase
            .from('whatsapp_connections')
            .update({
              is_connected: true,
              last_connected_at: new Date().toISOString(),
              qr_code: null,
              qr_code_expires_at: null
            })
            .eq('evolution_instance_name', instanceName);
          if (connErr) console.error('[Webhook] Error marking connected:', connErr);
        } else if (state === 'close' || state === 'connecting') {
          // Desconectou ou reconectando — marca desconectado
          const { error: dcErr } = await supabase
            .from('whatsapp_connections')
            .update({ is_connected: false })
            .eq('evolution_instance_name', instanceName);
          if (dcErr) console.error('[Webhook] Error marking disconnected:', dcErr);
        }
        return new Response(JSON.stringify({ status: 'connection_update_processed', state }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Handle message status updates (for campaigns)
      if (event === 'messages.update') {
        const updates = Array.isArray(data) ? data : [data];
        
        for (const update of updates) {
          const messageId = update.key?.id;
          const status = update.update?.status;
          
          if (!messageId) continue;
          
          // Update campaign lead status
          if (status === 'DELIVERY_ACK' || status === 'delivered') {
            await supabase
              .from('campaign_leads')
              .update({ 
                status: 'delivered',
                delivered_at: new Date().toISOString() 
              })
              .eq('whatsapp_message_id', messageId)
              .eq('status', 'sent');

            // Atomic counter increment
            const { data: lead } = await supabase
              .from('campaign_leads')
              .select('campaign_id')
              .eq('whatsapp_message_id', messageId)
              .maybeSingle();

            if (lead) {
              await supabase.rpc('increment_campaign_counter', { 
                p_campaign_id: lead.campaign_id, 
                p_counter: 'total_delivered' 
              });
            }
          }
          
          if (status === 'READ' || status === 'read') {
            await supabase
              .from('campaign_leads')
              .update({ 
                status: 'read',
                read_at: new Date().toISOString() 
              })
              .eq('whatsapp_message_id', messageId)
              .in('status', ['sent', 'delivered']);

            const { data: lead } = await supabase
              .from('campaign_leads')
              .select('campaign_id')
              .eq('whatsapp_message_id', messageId)
              .maybeSingle();

            if (lead) {
              await supabase.rpc('increment_campaign_counter', { 
                p_campaign_id: lead.campaign_id, 
                p_counter: 'total_read' 
              });
            }
          }
        }
        
        return new Response(JSON.stringify({ status: 'status_update_processed' }), { 
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

      // Find the user who owns this Evolution instance and get grouping settings
      const { data: ownerSettings } = await supabase
        .from('nina_settings')
        .select('user_id, evolution_api_url, evolution_api_key, message_grouping_enabled, message_grouping_delay')
        .eq('evolution_instance_name', instanceName)
        .maybeSingle();

      // Get configurable grouping delay (default 20 seconds)
      const groupingEnabled = ownerSettings?.message_grouping_enabled !== false;
      const groupingDelay = ownerSettings?.message_grouping_delay || DEFAULT_GROUPING_DELAY_MS;
      
      console.log(`[Webhook] Grouping config - enabled: ${groupingEnabled}, delay: ${groupingDelay}ms`);

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

      // WhatsApp vem migrando alguns contatos para JIDs "@lid" (Linked ID,
      // anonimizado) em vez do JID tradicional com o número de telefone.
      // Quando isso acontece, a Evolution API (>=6.8.0) expõe o JID real
      // com o telefone em key.remoteJidAlt — sem isso, o telefone extraído
      // não bate com o contato existente e o webhook cria contato/conversa
      // duplicados para a mesma pessoa.
      const resolvedJid = remoteJid.endsWith('@lid') && data.key?.remoteJidAlt
        ? data.key.remoteJidAlt
        : remoteJid;
      const phoneNumber = resolvedJid.replace('@s.whatsapp.net', '').replace('@lid', '');
      const contactName = data.pushName || null;
      const messageId = data.key?.id;
      const messageTimestamp = data.messageTimestamp || Math.floor(Date.now() / 1000);

      console.log(`[Webhook] Processing message from ${phoneNumber} (${contactName})`);

      // ═══════════════════════════════════════════
      // PROTEÇÃO CONTRA RE-DELIVERY / MENSAGENS ANTIGAS
      // ═══════════════════════════════════════════
      const messageAge = Date.now() - (messageTimestamp * 1000);
      const messageAgeMinutes = messageAge / 1000 / 60;
      const MAX_MESSAGE_AGE_MINUTES = 60;

      if (messageAgeMinutes > MAX_MESSAGE_AGE_MINUTES) {
        console.log('[Webhook] ⚠️ MENSAGEM ANTIGA DETECTADA (re-delivery)');
        console.log('[Webhook] - Idade:', Math.round(messageAgeMinutes), 'minutos');
        console.log('[Webhook] - Timestamp original:', new Date(messageTimestamp * 1000).toISOString());
        // Still save the message but skip AI processing - handled below with skipAIProcessing flag
      }
      const skipAIProcessing = messageAgeMinutes > MAX_MESSAGE_AGE_MINUTES;

      // Check if this is a reply to a campaign message
      const { data: campaignLead } = await supabase
        .from('campaign_leads')
        .select('id, campaign_id, status')
        .eq('phone', phoneNumber)
        .in('status', ['sent', 'delivered', 'read'])
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (campaignLead) {
        console.log('[Webhook] Reply from campaign lead detected');
        
        // Update lead status to replied
        await supabase
          .from('campaign_leads')
          .update({ 
            status: 'replied',
            replied_at: new Date().toISOString()
          })
          .eq('id', campaignLead.id);

        // Update campaign replied counter
        await supabase.rpc('increment_campaign_counter', { 
          p_campaign_id: campaignLead.campaign_id, 
          p_counter: 'total_replied' 
        });
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
            whatsapp_id: remoteJid,
            name: contactName,
            call_name: contactName?.split(' ')[0] || null,
            user_id: ownerId
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

      // Contato bloqueado: ignora a mensagem completamente (não salva, não
      // cria/reabre conversa, não aciona a IA) — é como se o número não
      // existisse mais pro sistema.
      if (contact.is_blocked) {
        console.log('[Webhook] 🚫 Contato bloqueado, ignorando mensagem:', contact.id);
        return new Response(JSON.stringify({ status: 'blocked' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Conexão que recebeu esta mensagem — precisa ser resolvida ANTES de
      // buscar a conversa: o mesmo contato pode ter conversas independentes
      // em números diferentes (ex: testou tanto o Automax quanto o
      // Atendimento). Sem escopar por connection_id, uma conversa já ativa
      // numa OUTRA conexão era reaproveitada aqui, e a resposta saía pelo
      // número errado.
      const { data: connection } = await supabase
        .from('whatsapp_connections')
        .select('id, default_queue_id')
        .eq('evolution_instance_name', instanceName)
        .maybeSingle();

      // 2. Get or create conversation (filtra por api_source + connection_id)
      let conversationQuery = supabase
        .from('conversations')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('is_active', true)
        .eq('api_source', 'evolution');
      conversationQuery = connection?.id
        ? conversationQuery.eq('connection_id', connection.id)
        : conversationQuery.is('connection_id', null);
      let { data: conversation } = await conversationQuery.maybeSingle();

      // If no active evolution conversation exists nesta conexão, tenta
      // reabrir a mais recente já encerrada (mesma conexão) antes de criar
      // uma nova — evita "perder" o histórico de mensagens numa conversa
      // antiga que a UI do Chat não mostra mais (só lista is_active=true).
      if (!conversation) {
        let existingQuery = supabase
          .from('conversations')
          .select('*')
          .eq('contact_id', contact.id)
          .eq('api_source', 'evolution');
        existingQuery = connection?.id
          ? existingQuery.eq('connection_id', connection.id)
          : existingQuery.is('connection_id', null);
        const { data: existingConversation } = await existingQuery
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingConversation) {
          const { data: reopened, error: reopenError } = await supabase
            .from('conversations')
            .update({ is_active: true, status: 'nina' })
            .eq('id', existingConversation.id)
            .select()
            .single();

          if (reopenError) {
            console.error('[Webhook] Error reopening conversation:', reopenError);
          } else {
            conversation = reopened;
            console.log('[Webhook] Reopened existing conversation:', conversation.id);
          }
        }
      }

      // Se realmente não existe nenhuma conversa anterior nesta conexão
      // (contato novo, ou contato antigo falando com um número novo), cria uma
      if (!conversation) {
        // Campanha recorrente ativa do contato, se houver (fila padrão já
        // vem da conexão resolvida acima)
        const { data: activeCampaign } = await supabase
          .from('campaign_contacts')
          .select('campaign_id')
          .eq('contact_id', contact.id)
          .eq('status', 'in_progress')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contact.id,
            status: 'nina',
            is_active: true,
            api_source: 'evolution',
            user_id: ownerId,
            connection_id: connection?.id ?? null,
            queue_id: connection?.default_queue_id ?? null,
            campaign_id: activeCampaign?.campaign_id ?? null
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
      } else if (msg?.contactMessage) {
        // Cartão de contato vCard enviado pelo cliente
        const displayName = msg.contactMessage.displayName || '';
        const vcard = msg.contactMessage.vcard || '';
        // Extrair telefone do vCard (linha TEL:...)
        const telMatch = vcard.match(/TEL[^:]*:([^\r\n]+)/);
        const phone = telMatch ? telMatch[1].trim() : '';
        messageContent = phone
          ? `📇 Contato compartilhado: ${displayName} (${phone})`
          : `📇 Contato compartilhado: ${displayName || '[sem nome]'}`;
        messageType = 'text';
        console.log('[Webhook] 📇 Contato compartilhado:', messageContent);
      } else if (msg?.contactsArrayMessage) {
        // Múltiplos contatos
        const contacts = msg.contactsArrayMessage.contacts || [];
        const names = contacts.map((c: any) => c.displayName || '').filter(Boolean).join(', ');
        messageContent = `📇 Contatos compartilhados: ${names || '[sem nomes]'}`;
        messageType = 'text';
        console.log('[Webhook] 📇 Múltiplos contatos:', messageContent);
      } else if (msg?.stickerMessage) {
        // media-proxy usa o content-type real devolvido pela Evolution API
        // (image/webp), então o <img> do frontend exibe a figurinha normalmente.
        // A descrição por IA no nina-orchestrator assume JPEG e pode falhar
        // silenciosamente para webp — não crítico, só perde a descrição por IA.
        messageContent = '[figurinha recebida]';
        messageType = 'image';
        mediaType = 'image';
        mediaId = msg.stickerMessage.mediaKey;
        console.log('[Webhook] 🏷️ Figurinha recebida');
      } else if (msg?.reactionMessage) {
        const emoji = msg.reactionMessage.text || '';
        messageContent = emoji ? `Reagiu com ${emoji}` : 'Removeu a reação';
        messageType = 'text';
        console.log('[Webhook] 😀 Reação:', messageContent);
      } else if (msg?.locationMessage || msg?.liveLocationMessage) {
        const loc = msg.locationMessage || msg.liveLocationMessage;
        const lat = loc?.degreesLatitude;
        const lng = loc?.degreesLongitude;
        const label = loc?.name ? `${loc.name} - ` : '';
        messageContent = lat != null && lng != null
          ? `📍 Localização compartilhada: ${label}https://maps.google.com/?q=${lat},${lng}`
          : '📍 Localização compartilhada';
        messageType = 'text';
        console.log('[Webhook] 📍 Localização recebida');
      } else {
        messageContent = '[Mensagem recebida em formato não suportado pelo sistema]';
      }

      // 4. Create message with api_source
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
          // media_url guarda o whatsapp_message_id (não o mediaKey de criptografia
          // do Baileys) — é esse o identificador que getBase64FromMediaMessage
          // da Evolution API espera para baixar a mídia depois (transcrição/análise).
          media_url: mediaType ? messageId : null,
          api_source: 'evolution', // Mark as Evolution API message
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

      // 4b. Mark user responded (unlock AI anti-spam guard)
      await supabase.rpc('mark_user_responded', { p_conversation_id: conversation.id });
      console.log('[Webhook] ✅ mark_user_responded called for conversation:', conversation.id);

      // 5. Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);

      // 6. Queue for message grouping (or process immediately if disabled)
      // Skip AI processing for old messages (re-delivery protection)
      if (skipAIProcessing) {
        console.log('[Webhook] ⏭️ Skipping AI processing - old message (re-delivery)');

        // Sem isso, a mensagem fica salva no histórico sem nenhum sinal
        // visível de que ninguém (IA ou humano) vai responder — tag para
        // aparecer na lista de contatos e alguém revisar manualmente.
        const { data: contactTagsData } = await supabase
          .from('contacts')
          .select('tags')
          .eq('id', contact.id)
          .maybeSingle();
        const currentContactTags: string[] = contactTagsData?.tags || [];
        if (!currentContactTags.includes('MSG-ANTIGA-SEM-IA')) {
          await supabase
            .from('contacts')
            .update({ tags: [...currentContactTags, 'MSG-ANTIGA-SEM-IA'] })
            .eq('id', contact.id);
        }
      } else if (!groupingEnabled) {
        // Grouping disabled - process immediately via nina-orchestrator
        console.log('[Webhook] Grouping disabled, processing immediately');
        
        if (conversation.status === 'nina') {
          const { error: ninaQueueError } = await supabase
            .from('nina_processing_queue')
            .insert({
              message_id: dbMessage.id,
              conversation_id: conversation.id,
              contact_id: contact.id,
              priority: 1,
              context_data: {
                phone_number_id: instanceName,
                contact_name: contactName,
                message_type: messageType,
                grouped_count: 1,
                combined_content: messageContent
              }
            });

          if (ninaQueueError) {
            if (ninaQueueError.code === '23505') {
              console.log('[Webhook] Message already in Nina queue (duplicate prevented)');
            } else {
              console.error('[Webhook] Error queuing for Nina:', ninaQueueError);
            }
          } else {
            // Item já está na fila — retry aqui evita que uma falha de rede
            // transitória o deixe preso em 'pending' até a próxima mensagem
            // do mesmo contato (o que pode nunca acontecer).
            EdgeRuntime.waitUntil(
              triggerNinaOrchestrator(supabaseUrl, supabaseServiceKey, 'whatsapp-webhook-immediate')
            );
          }
        }
      } else if (conversation.status === 'nina') {
        // Grouping enabled - use delay queue
        const processAfter = new Date(Date.now() + groupingDelay).toISOString();
        
        console.log(`[Webhook] Grouping message from ${phoneNumber}, process_after: ${processAfter}`);

        // Update process_after for ALL pending messages from the same phone (extends timer)
        const { data: updatedMessages, error: updateError } = await supabase
          .from('message_grouping_queue')
          .update({ process_after: processAfter })
          .eq('processed', false)
          .filter('message_data->>from', 'eq', phoneNumber)
          .select('id');

        if (updateError) {
          console.error('[Webhook] Error extending timer for existing messages:', updateError);
        } else if (updatedMessages && updatedMessages.length > 0) {
          console.log(`[Webhook] Extended timer for ${updatedMessages.length} pending messages from ${phoneNumber}`);
        }

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
          console.log(`[Webhook] Message queued: ${messageId}, will process after ${groupingDelay}ms`);
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
      }

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
