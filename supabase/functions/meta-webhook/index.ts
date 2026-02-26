import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<any>): void;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-hub-signature-256',
};

const DEFAULT_GROUPING_DELAY_MS = 20000;

// Validate Meta webhook signature using Web Crypto API
async function validateMetaSignature(body: string, signature: string | null, appSecret: string): Promise<boolean> {
  if (!signature || !appSecret) {
    console.warn('[Meta Webhook] ⚠️ Missing signature or app secret - skipping validation');
    return true; // Se não tem secret configurado, aceita (para testes)
  }
  
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(appSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const expectedSignature = 'sha256=' + hashHex;
    
    const isValid = signature === expectedSignature;
    console.log('[Meta Webhook] Signature validation:', isValid ? '✅ VALID' : '❌ INVALID');
    
    return isValid;
  } catch (error) {
    console.error('[Meta Webhook] Error validating signature:', error);
    return false;
  }
}

serve(async (req) => {
  console.log('═══════════════════════════════════════════');
  console.log('[Meta Webhook] ⚡ REQUEST RECEIVED');
  console.log('[Meta Webhook] Method:', req.method);
  console.log('[Meta Webhook] Timestamp:', new Date().toISOString());
  console.log('[Meta Webhook] URL:', req.url);
  console.log('═══════════════════════════════════════════');

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // ═══════════════════════════════════════════
    // GET request = Webhook verification from Meta
    // ═══════════════════════════════════════════
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('[Meta Webhook GET] ═══════════════════════════════');
      console.log('[Meta Webhook GET] Verificação recebida');
      console.log('[Meta Webhook GET] Mode:', mode);
      console.log('[Meta Webhook GET] Token recebido:', token);
      console.log('[Meta Webhook GET] Challenge:', challenge);
      console.log('[Meta Webhook GET] ═══════════════════════════════');

      if (mode === 'subscribe' && token && challenge) {
        // Get verify token from settings
        const { data: settings } = await supabase
          .from('nina_settings')
          .select('whatsapp_verify_token')
          .limit(1)
          .maybeSingle();

        const verifyToken = settings?.whatsapp_verify_token || 'meta-webhook-verify';
        console.log('[Meta Webhook GET] Token esperado:', verifyToken);

        if (token === verifyToken) {
          console.log('[Meta Webhook GET] ✅ VERIFICAÇÃO SUCESSO');
          console.log('[Meta Webhook GET] Retornando challenge:', challenge);
          return new Response(challenge, { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
          });
        }
        
        console.log('[Meta Webhook GET] ❌ VERIFICAÇÃO FALHOU - Token não confere');
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }

      // Health check
      return new Response(JSON.stringify({ 
        status: 'ok', 
        api: 'meta-webhook',
        timestamp: new Date().toISOString()
      }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // ═══════════════════════════════════════════
    // POST request = Incoming message from Meta
    // ═══════════════════════════════════════════
    if (req.method === 'POST') {
      const rawBody = await req.text();
      
      console.log('[Meta Webhook POST] ═══════════════════════════════');
      console.log('[Meta Webhook POST] ⚡ PAYLOAD RECEBIDO');
      console.log('[Meta Webhook POST] Raw body length:', rawBody.length);
      
      let body: any;
      try {
        body = JSON.parse(rawBody);
        console.log('[Meta Webhook POST] Body parsed:');
        console.log(JSON.stringify(body, null, 2));
      } catch (parseError) {
        console.error('[Meta Webhook POST] ❌ ERRO ao parsear JSON:', parseError);
        return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
      }
      console.log('[Meta Webhook POST] ═══════════════════════════════');

      // ⚠️ CRÍTICO: SEMPRE retornar 200 IMEDIATAMENTE
      // Meta desativa webhook se demorar mais de 5 segundos
      // O processamento ocorre de forma assíncrona via EdgeRuntime.waitUntil
      
      EdgeRuntime.waitUntil(
        processMetaWebhookAsync(supabase, supabaseUrl, supabaseServiceKey, rawBody, body, req.headers.get('x-hub-signature-256'))
          .catch(error => {
            console.error('[Meta Webhook POST] ❌ Erro no processamento assíncrono:', error);
          })
      );

      console.log('[Meta Webhook POST] ✅ Retornando 200 imediatamente');
      return new Response('EVENT_RECEIVED', { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
      });
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  } catch (error) {
    console.error('[Meta Webhook] ❌ ERRO CRÍTICO:', error);
    // Mesmo com erro, retornar 200 (Meta exige)
    return new Response('EVENT_RECEIVED', { status: 200, headers: corsHeaders });
  }
});

// ═══════════════════════════════════════════
// FUNÇÃO ASSÍNCRONA PARA PROCESSAR WEBHOOK
// ═══════════════════════════════════════════
async function processMetaWebhookAsync(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  rawBody: string,
  body: any,
  signature: string | null
) {
  console.log('[Meta Async] ═══════════════════════════════');
  console.log('[Meta Async] 🔄 Iniciando processamento assíncrono');
  console.log('[Meta Async] Timestamp:', new Date().toISOString());

  try {
    // Get Meta settings
    const { data: metaSettings, error: settingsError } = await supabase
      .from('nina_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('[Meta Async] ❌ Erro ao buscar settings:', settingsError);
      return;
    }

    if (!metaSettings) {
      console.warn('[Meta Async] ⚠️ Nenhum nina_settings encontrado');
      return;
    }

    console.log('[Meta Async] Settings carregados:');
    console.log('[Meta Async] - meta_api_enabled:', metaSettings.meta_api_enabled);
    console.log('[Meta Async] - meta_phone_number_id:', metaSettings.meta_phone_number_id);
    console.log('[Meta Async] - message_grouping_enabled:', metaSettings.message_grouping_enabled);
    console.log('[Meta Async] - ai_activation_delay_minutes:', metaSettings.ai_activation_delay_minutes);

    // Validate signature if app secret is configured
    if (metaSettings.meta_app_secret && signature) {
      const isValid = await validateMetaSignature(rawBody, signature, metaSettings.meta_app_secret);
      if (!isValid) {
        console.error('[Meta Async] ❌ Assinatura inválida - ignorando webhook');
        return;
      }
    } else {
      console.log('[Meta Async] ⚠️ Sem app_secret configurado ou sem assinatura - prosseguindo');
    }

    const groupingEnabled = metaSettings.message_grouping_enabled !== false;
    const groupingDelay = metaSettings.message_grouping_delay || DEFAULT_GROUPING_DELAY_MS;
    const aiActivationDelayMinutes = metaSettings.ai_activation_delay_minutes ?? 5;

    // Validar estrutura do body
    if (!body || !body.entry || !Array.isArray(body.entry)) {
      console.log('[Meta Async] ⚠️ Body não tem entry válido');
      console.log('[Meta Async] Body recebido:', JSON.stringify(body, null, 2));
      return;
    }

    const entry = body.entry[0];
    console.log('[Meta Async] Entry:', JSON.stringify(entry, null, 2));

    if (!entry || !entry.changes || !Array.isArray(entry.changes)) {
      console.log('[Meta Async] ⚠️ Entry não tem changes válido');
      return;
    }

    const changes = entry.changes[0];
    console.log('[Meta Async] Changes:', JSON.stringify(changes, null, 2));

    if (!changes || !changes.value) {
      console.log('[Meta Async] ⚠️ Changes não tem value válido');
      return;
    }

    const value = changes.value;
    console.log('[Meta Async] Value:', JSON.stringify(value, null, 2));

    // ═══════════════════════════════════════════
    // Processar STATUS de mensagens
    // ═══════════════════════════════════════════
    if (value.statuses && Array.isArray(value.statuses)) {
      console.log('[Meta Async] 📊 Encontrados', value.statuses.length, 'status updates');

      for (const status of value.statuses) {
        const messageId = status.id;
        const statusType = status.status;
        const timestamp = status.timestamp;
        
        console.log('[Meta Async] Status update:', messageId, '->', statusType);
        
        const updateData: any = {};
        if (statusType === 'delivered') {
          updateData.status = 'delivered';
          updateData.delivered_at = new Date(parseInt(timestamp) * 1000).toISOString();
        } else if (statusType === 'read') {
          updateData.status = 'read';
          updateData.read_at = new Date(parseInt(timestamp) * 1000).toISOString();
        } else if (statusType === 'failed') {
          updateData.status = 'failed';
        }
        
        if (Object.keys(updateData).length > 0) {
          // Update messages table
          const { error } = await supabase
            .from('messages')
            .update(updateData)
            .eq('whatsapp_message_id', messageId);
          
          if (error) {
            console.error('[Meta Async] Erro ao atualizar status na messages:', error);
          } else {
            console.log('[Meta Async] ✅ Status atualizado na messages');
          }

          // Update campaign_leads table and campaign counters
          const leadUpdateData: any = {};
          let counterField = '';
          if (statusType === 'delivered') {
            leadUpdateData.status = 'delivered';
            leadUpdateData.delivered_at = updateData.delivered_at;
            counterField = 'total_delivered';
          } else if (statusType === 'read') {
            leadUpdateData.status = 'read';
            leadUpdateData.read_at = updateData.read_at;
            counterField = 'total_read';
          } else if (statusType === 'failed') {
            leadUpdateData.status = 'error';
            leadUpdateData.error_message = status.errors?.[0]?.title || 'Message failed';
            counterField = 'total_errors';
          }

          // Find and update campaign_lead by whatsapp_message_id
          const { data: updatedLeads, error: leadError } = await supabase
            .from('campaign_leads')
            .update(leadUpdateData)
            .eq('whatsapp_message_id', messageId)
            .select('campaign_id, status');
          
          if (leadError) {
            console.error('[Meta Async] Erro ao atualizar campaign_lead:', leadError);
          } else if (updatedLeads && updatedLeads.length > 0 && counterField) {
            // Increment the campaign counter
            const campaignId = updatedLeads[0].campaign_id;
            console.log(`[Meta Async] 📈 Incrementando ${counterField} da campanha ${campaignId}`);
            
            const { error: counterError } = await supabase.rpc('increment_campaign_counter', {
              p_campaign_id: campaignId,
              p_counter: counterField
            });
            
            if (counterError) {
              console.error('[Meta Async] Erro ao incrementar contador:', counterError);
            } else {
              console.log(`[Meta Async] ✅ ${counterField} incrementado`);
            }
          }
        }
      }

      // Also check for replied status from incoming messages linked to campaigns
      console.log('[Meta Async] ✅ Status updates processados');
      return;
    }

    // ═══════════════════════════════════════════
    // Processar MENSAGENS recebidas
    // ═══════════════════════════════════════════
    if (value.messages && Array.isArray(value.messages)) {
      console.log('[Meta Async] 📩 Encontradas', value.messages.length, 'mensagens');

      for (const message of value.messages) {
        console.log('[Meta Async] ─────────────────────────────');
        console.log('[Meta Async] Processando mensagem:', message.id);

        const phoneNumber = message.from;
        const messageId = message.id;
        const messageType = message.type;
        const timestamp = parseInt(message.timestamp) * 1000;

        console.log('[Meta Async] De:', phoneNumber);
        console.log('[Meta Async] ID:', messageId);
        console.log('[Meta Async] Tipo:', messageType);
        console.log('[Meta Async] Timestamp:', timestamp);

        // Get contact info
        const contactInfo = value.contacts?.find((c: any) => c.wa_id === phoneNumber);
        const contactName = contactInfo?.profile?.name || null;
        console.log('[Meta Async] Nome do contato:', contactName);

        // Extract message content based on type
        let messageContent = '';
        let dbMessageType = 'text';
        let mediaType: string | null = null;
        let mediaUrl: string | null = null;

        switch (messageType) {
          case 'text':
            messageContent = message.text?.body || '';
            dbMessageType = 'text';
            console.log('[Meta Async] 💬 Texto:', messageContent);
            break;
          case 'image':
            messageContent = message.image?.caption || '[imagem recebida]';
            dbMessageType = 'image';
            mediaType = 'image';
            mediaUrl = message.image?.id;
            console.log('[Meta Async] 🖼️ Imagem recebida');
            break;
          case 'audio':
            messageContent = '[áudio recebido]';
            dbMessageType = 'audio';
            mediaType = 'audio';
            mediaUrl = message.audio?.id;
            console.log('[Meta Async] 🎵 Áudio recebido');
            break;
          case 'video':
            messageContent = message.video?.caption || '[vídeo recebido]';
            dbMessageType = 'video';
            mediaType = 'video';
            mediaUrl = message.video?.id;
            console.log('[Meta Async] 🎥 Vídeo recebido');
            break;
          case 'document':
            messageContent = message.document?.filename || '[documento recebido]';
            dbMessageType = 'document';
            mediaType = 'document';
            mediaUrl = message.document?.id;
            console.log('[Meta Async] 📄 Documento recebido');
            break;
          case 'button':
            messageContent = message.button?.text || '[botão clicado]';
            dbMessageType = 'text';
            console.log('[Meta Async] 🔘 Botão clicado');
            break;
          case 'interactive':
            const interactive = message.interactive;
            messageContent = interactive?.button_reply?.title || 
                            interactive?.list_reply?.title || 
                            '[resposta interativa]';
            dbMessageType = 'text';
            console.log('[Meta Async] 📋 Resposta interativa');
            break;
          case 'contacts': {
            // Cartão de contato vCard enviado pelo cliente
            const contactCards = message.contacts || [];
            const names = contactCards.map((c: any) => {
              const formatted = c.name?.formatted_name || c.name?.first_name || '';
              const phones = (c.phones || []).map((p: any) => p.phone || p.wa_id || '').filter(Boolean).join(', ');
              return phones ? `${formatted} (${phones})` : formatted;
            }).filter(Boolean);
            messageContent = names.length > 0
              ? `📇 Contato compartilhado: ${names.join(', ')}`
              : '[contato compartilhado]';
            dbMessageType = 'text';
            console.log('[Meta Async] 📇 Contato compartilhado:', messageContent);
            break;
          }
          default:
            messageContent = `[mensagem do tipo: ${messageType}]`;
            console.log('[Meta Async] ❓ Tipo desconhecido:', messageType);
        }

        // ═══════════════════════════════════════════
        // 1. BUSCAR OU CRIAR CONTATO (com normalização de número BR)
        // ═══════════════════════════════════════════
        console.log('[Meta Async] 📞 Buscando contato...');

        // Normalizar número: gerar variantes com/sem dígito 9 extra (Brasil)
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const phoneVariants = [cleanPhone];
        // 13 dígitos (55 + DDD + 9 + 8 dígitos) → tentar sem o 9
        if (cleanPhone.length === 13 && cleanPhone.startsWith('55')) {
          phoneVariants.push(cleanPhone.slice(0, 4) + cleanPhone.slice(5));
        }
        // 12 dígitos (55 + DDD + 8 dígitos) → tentar com o 9
        if (cleanPhone.length === 12 && cleanPhone.startsWith('55')) {
          phoneVariants.push(cleanPhone.slice(0, 4) + '9' + cleanPhone.slice(4));
        }
        console.log('[Meta Async] 🔍 Variantes de telefone:', phoneVariants);

        const { data: existingContacts } = await supabase
          .from('contacts')
          .select('*')
          .in('phone_number', phoneVariants);

        let contact = existingContacts && existingContacts.length > 0 ? existingContacts[0] : null;

        if (!contact) {
          console.log('[Meta Async] ➕ Criando novo contato');

          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              phone_number: phoneNumber,
              whatsapp_id: phoneNumber,
              name: contactName,
              call_name: contactName?.split(' ')[0] || null,
              user_id: metaSettings.user_id || null
            })
            .select()
            .single();

          if (contactError) {
            console.error('[Meta Async] ❌ Erro ao criar contato:', contactError);
            continue;
          }
          contact = newContact;
          console.log('[Meta Async] ✅ Contato criado:', contact.id);
        } else {
          console.log('[Meta Async] ✅ Contato encontrado:', contact.id, '(phone:', contact.phone_number, ')');

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

        // ═══════════════════════════════════════════
        // 2. BUSCAR OU CRIAR CONVERSA
        // ═══════════════════════════════════════════
        console.log('[Meta Async] 💬 Buscando conversa...');

        // Buscar conversa ativa para este contato VIA META
        let { data: conversation } = await supabase
          .from('conversations')
          .select('*')
          .eq('contact_id', contact.id)
          .eq('is_active', true)
          .eq('api_source', 'meta')
          .maybeSingle();

        if (!conversation) {
          console.log('[Meta Async] ➕ Criando nova conversa');

          const { data: newConversation, error: convError } = await supabase
            .from('conversations')
            .insert({
              contact_id: contact.id,
              status: 'nina',
              is_active: true,
              api_source: 'meta',
              user_id: metaSettings.user_id || null
            })
            .select()
            .single();

          if (convError) {
            console.error('[Meta Async] ❌ Erro ao criar conversa:', convError);
            continue;
          }
          conversation = newConversation;
          console.log('[Meta Async] ✅ Conversa criada:', conversation.id);
        } else {
          console.log('[Meta Async] ✅ Conversa encontrada:', conversation.id);

          // Update api_source if changed
          if (conversation.api_source !== 'meta') {
            console.log('[Meta Async] 🔄 Atualizando api_source para meta');
            await supabase
              .from('conversations')
              .update({ api_source: 'meta' })
              .eq('id', conversation.id);
          }
        }

        // ═══════════════════════════════════════════
        // 3. DETECÇÃO ANTECIPADA DE MENSAGENS AUTOMÁTICAS (BOTS)
        // ═══════════════════════════════════════════
        const botPatterns = [
          /^\u200e/,                          // Caractere invisível ‎ no início (comum em bots)
          /agradece\s+seu\s+contato/i,        // "agradece seu contato"
          /obrigad[oa]\s+por\s+entrar\s+em\s+contato/i,
          /como\s+podemos\s+(te\s+)?ajudar\??$/i, // "Como podemos ajudar?"
          /bem[- ]?vind[oa]\s+(à|a|ao)/i,     // "Bem-vindo(a) à/ao"
          /atendimento\s+autom[aá]tico/i,
          /digite\s+\d+\s+para/i,             // "Digite 1 para..."
          /escolha\s+uma?\s+(das\s+)?opç(ão|ões)/i,
          /hor[aá]rio\s+de\s+atendimento/i,
          /fora\s+do\s+hor[aá]rio/i,
          /no\s+momento\s+n[ãa]o\s+estamos/i,
          /resposta\s+autom[aá]tica/i,
          /mensagem\s+autom[aá]tica/i,
        ];

        const isLikelyBot = messageContent ? botPatterns.some(p => p.test(messageContent)) : false;

        if (isLikelyBot) {
          console.log('[Meta Async] 🤖🚫 MENSAGEM AUTOMÁTICA DETECTADA ANTES DE SALVAR!');
          console.log('[Meta Async] - Conteúdo:', messageContent?.substring(0, 80));
          console.log('[Meta Async] - Será salva como from_type=nina para não afetar contexto da IA');
          
          // Marcar dispatch_sent_at para ativar o delay mesmo em conversas inbound
          if (!conversation.dispatch_sent_at) {
            await supabase
              .from('conversations')
              .update({ dispatch_sent_at: new Date().toISOString() })
              .eq('id', conversation.id);
            conversation.dispatch_sent_at = new Date().toISOString();
            console.log('[Meta Async] - dispatch_sent_at definido para proteção anti-bot');
          }
        }

        // ═══════════════════════════════════════════
        // 4. SALVAR MENSAGEM
        // ═══════════════════════════════════════════
        console.log('[Meta Async] 💾 Salvando mensagem...');

        // Se for bot, salvar como 'nina' para não contaminar contexto da IA
        const fromType = isLikelyBot ? 'nina' : 'user';

        const { data: dbMessage, error: msgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversation.id,
            whatsapp_message_id: messageId,
            content: messageContent,
            type: dbMessageType,
            from_type: fromType,
            status: 'sent',
            media_type: mediaType,
            media_url: mediaUrl,
            api_source: 'meta',
            sent_at: new Date(timestamp).toISOString(),
            metadata: { 
              original_type: messageType,
              meta_phone_number_id: metaSettings.meta_phone_number_id,
              contact_name: contactName,
              is_auto_reply: isLikelyBot
            }
          })
          .select()
          .single();

        if (msgError) {
          if (msgError.code === '23505') {
            console.log('[Meta Async] ⚠️ Mensagem duplicada ignorada:', messageId);
            continue;
          }
          console.error('[Meta Async] ❌ Erro ao salvar mensagem:', msgError);
          continue;
        }

        console.log('[Meta Async] ✅ Mensagem salva:', dbMessage.id, '| from_type:', fromType);

        // ═══════════════════════════════════════════
        // 5. ATUALIZAR CONVERSA
        // ═══════════════════════════════════════════
        await supabase
          .from('conversations')
          .update({ last_message_at: new Date().toISOString() })
          .eq('id', conversation.id);

        // ═══════════════════════════════════════════
        // 6. SE FOR BOT, NÃO PROCESSAR NA IA
        // ═══════════════════════════════════════════
        if (isLikelyBot) {
          console.log('[Meta Async] 🤖 Bot detectado - pulando processamento da IA');
          continue;
        }

        // ═══════════════════════════════════════════
        // 7. VERIFICAR SE MENSAGEM É MUITO ANTIGA (re-delivery da Meta)
        // ═══════════════════════════════════════════
        const messageAge = Date.now() - timestamp;
        const messageAgeMinutes = messageAge / 1000 / 60;
        const MAX_MESSAGE_AGE_MINUTES = 60; // 1 hora

        if (messageAgeMinutes > MAX_MESSAGE_AGE_MINUTES) {
          console.log('[Meta Async] ⚠️ MENSAGEM ANTIGA DETECTADA (re-delivery da Meta)');
          console.log('[Meta Async] - Idade:', Math.round(messageAgeMinutes), 'minutos');
          console.log('[Meta Async] - Timestamp original:', new Date(timestamp).toISOString());
          console.log('[Meta Async] - Hora atual:', new Date().toISOString());
          console.log('[Meta Async] - Mensagem salva no histórico mas NÃO será processada pela IA');
          continue; // Salva a mensagem mas pula o processamento da IA
        }

        // ═══════════════════════════════════════════
        // 7. VERIFICAR DELAY DE ATIVAÇÃO DA IA E ADICIONAR À FILA
        // ═══════════════════════════════════════════
        console.log('[Meta Async] 🤖 Verificando fila da IA...');
        console.log('[Meta Async] - Status da conversa:', conversation.status);
        console.log('[Meta Async] - Grouping enabled:', groupingEnabled);
        console.log('[Meta Async] - AI Activation Delay (min):', aiActivationDelayMinutes);
        console.log('[Meta Async] - dispatch_sent_at:', conversation.dispatch_sent_at);
        console.log('[Meta Async] - Bot detectado:', isLikelyBot);

        if (conversation.status === 'nina') {
          // ═══════════════════════════════════════════
          // VERIFICAR DELAY DE ATIVAÇÃO APÓS DISPARO OU BOT
          // ═══════════════════════════════════════════
          let canProcessAI = true;
          let delayRemainingMinutes = 0;

          if (aiActivationDelayMinutes > 0 && conversation.dispatch_sent_at) {
            const dispatchTime = new Date(conversation.dispatch_sent_at);
            const now = new Date();
            const minutesSinceDispatch = (now.getTime() - dispatchTime.getTime()) / 1000 / 60;
            
            console.log('[Meta Async] 📊 Verificando delay de ativação:');
            console.log('[Meta Async] - Disparo/bot detectado em:', dispatchTime.toISOString());
            console.log('[Meta Async] - Hora atual:', now.toISOString());
            console.log('[Meta Async] - Minutos desde evento:', minutesSinceDispatch.toFixed(2));
            console.log('[Meta Async] - Delay configurado:', aiActivationDelayMinutes, 'minutos');

            if (minutesSinceDispatch < aiActivationDelayMinutes) {
              canProcessAI = false;
              delayRemainingMinutes = Math.ceil(aiActivationDelayMinutes - minutesSinceDispatch);
              console.log('[Meta Async] ⏸️ IA AINDA EM DELAY');
              console.log('[Meta Async] - Faltam:', delayRemainingMinutes, 'minutos');
              console.log('[Meta Async] - Mensagem será armazenada mas NÃO processada pela IA');
            } else {
              console.log('[Meta Async] ✅ Delay expirado, IA pode responder');
              await supabase
                .from('conversations')
                .update({ dispatch_sent_at: null })
                .eq('id', conversation.id);
            }
          } else if (!conversation.dispatch_sent_at) {
            console.log('[Meta Async] ℹ️ Não é conversa de disparo/bot (inbound humano), processando normalmente');
          } else {
            console.log('[Meta Async] ℹ️ Delay desabilitado (0 min), processando imediatamente');
          }

          // Só adiciona à fila se delay permitir
          if (canProcessAI) {
            if (!groupingEnabled) {
              // Process immediately
              console.log('[Meta Async] 🚀 Adicionando à fila imediata...');

              const { error: queueError } = await supabase
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

              if (queueError) {
                console.error('[Meta Async] ❌ Erro ao adicionar à fila:', queueError);
              } else {
                console.log('[Meta Async] ✅ Adicionado à fila');
              }

              // Trigger nina-orchestrator
              console.log('[Meta Async] 🔔 Disparando nina-orchestrator...');
              try {
                const response = await fetch(`${supabaseUrl}/functions/v1/nina-orchestrator`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`
                  },
                  body: JSON.stringify({ triggered_by: 'meta-webhook-immediate' })
                });
                console.log('[Meta Async] ✅ nina-orchestrator triggered:', response.status);
              } catch (err) {
                console.error('[Meta Async] ❌ Erro ao chamar nina-orchestrator:', err);
              }
            } else {
              // Use grouping queue
              const processAfter = new Date(Date.now() + groupingDelay).toISOString();
              console.log('[Meta Async] 📦 Usando grouping queue, process_after:', processAfter);
              
              // Extend timer for existing messages
              await supabase
                .from('message_grouping_queue')
                .update({ process_after: processAfter })
                .eq('processed', false)
                .filter('message_data->>from', 'eq', phoneNumber);

              const { error: groupError } = await supabase
                .from('message_grouping_queue')
                .insert({
                  whatsapp_message_id: messageId,
                  phone_number_id: metaSettings.meta_phone_number_id || '',
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

              if (groupError) {
                console.error('[Meta Async] ❌ Erro ao adicionar ao grouping:', groupError);
              } else {
                console.log('[Meta Async] ✅ Adicionado ao grouping queue');
              }

              // Trigger message-grouper
              console.log('[Meta Async] 🔔 Disparando message-grouper...');
              try {
                const response = await fetch(`${supabaseUrl}/functions/v1/message-grouper`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`
                  },
                  body: JSON.stringify({ triggered_by: 'meta-webhook' })
                });
                console.log('[Meta Async] ✅ message-grouper triggered:', response.status);
              } catch (err) {
                console.error('[Meta Async] ❌ Erro ao chamar message-grouper:', err);
              }
            }
          } else {
            console.log('[Meta Async] ⏸️ IA em delay - mensagem armazenada mas NÃO processada');
            console.log('[Meta Async] ⏱️ IA será ativada em', delayRemainingMinutes, 'minuto(s)');
          }
        } else {
          console.log('[Meta Async] ⏸️ Conversa não está com Nina, ignorando IA');
        }

        console.log('[Meta Async] ✅ Mensagem processada com sucesso');
        console.log('[Meta Async] ─────────────────────────────');
      }
    } else {
      console.log('[Meta Async] ℹ️ Sem mensagens no webhook (pode ser outro tipo de evento)');
    }

    console.log('[Meta Async] ✅ PROCESSAMENTO ASSÍNCRONO COMPLETO');
    console.log('[Meta Async] ═══════════════════════════════');

  } catch (error) {
    console.error('[Meta Async] ❌ ERRO no processamento:', error);
    if (error instanceof Error) {
      console.error('[Meta Async] Stack:', error.stack);
    }
  }
}
