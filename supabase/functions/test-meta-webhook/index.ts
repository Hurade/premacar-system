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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log('═══════════════════════════════════════════');
  console.log('[Test Meta Webhook] 🧪 INICIANDO TESTE');
  console.log('═══════════════════════════════════════════');

  try {
    const body = await req.json().catch(() => ({}));
    const testPhone = body.phone || '5548999999999';
    const testMessage = body.message || 'Mensagem de teste do webhook Meta';

    console.log('[Test] Telefone de teste:', testPhone);
    console.log('[Test] Mensagem de teste:', testMessage);

    // Get Meta settings
    const { data: settings, error: settingsError } = await supabase
      .from('nina_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('[Test] Erro ao buscar settings:', settingsError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao buscar settings',
        details: settingsError
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[Test] Settings encontrados:');
    console.log('[Test] - meta_api_enabled:', settings?.meta_api_enabled);
    console.log('[Test] - meta_phone_number_id:', settings?.meta_phone_number_id);
    console.log('[Test] - meta_access_token:', settings?.meta_access_token ? 'CONFIGURADO' : 'NÃO CONFIGURADO');
    console.log('[Test] - meta_app_secret:', settings?.meta_app_secret ? 'CONFIGURADO' : 'NÃO CONFIGURADO');
    console.log('[Test] - message_grouping_enabled:', settings?.message_grouping_enabled);

    // Simular payload do Meta
    const mockPayload = {
      object: 'whatsapp_business_account',
      entry: [{
        id: 'MOCK_WABA_ID',
        changes: [{
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: settings?.meta_phone_number_id || 'TEST_PHONE',
              phone_number_id: settings?.meta_phone_number_id || 'TEST_PHONE_ID'
            },
            contacts: [{
              profile: { name: 'Teste Webhook' },
              wa_id: testPhone
            }],
            messages: [{
              from: testPhone,
              id: `wamid.test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
              timestamp: Math.floor(Date.now() / 1000).toString(),
              type: 'text',
              text: {
                body: testMessage
              }
            }]
          },
          field: 'messages'
        }]
      }]
    };

    console.log('[Test] Payload simulado:', JSON.stringify(mockPayload, null, 2));

    // Chamar o meta-webhook diretamente
    console.log('[Test] 🚀 Chamando meta-webhook...');

    const webhookResponse = await fetch(`${supabaseUrl}/functions/v1/meta-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify(mockPayload)
    });

    const webhookResult = await webhookResponse.text();
    console.log('[Test] Resposta do webhook:', webhookResponse.status, webhookResult);

    // Aguardar processamento assíncrono
    console.log('[Test] ⏳ Aguardando processamento assíncrono (3s)...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verificar se a mensagem foi salva
    console.log('[Test] 🔍 Verificando mensagem no banco...');

    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('api_source', 'meta')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('[Test] Mensagens encontradas:', messages?.length || 0);
    if (messages && messages.length > 0) {
      console.log('[Test] Última mensagem:', JSON.stringify(messages[0], null, 2));
    }

    // Verificar contato
    const { data: contacts } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone_number', testPhone)
      .limit(1);

    console.log('[Test] Contato encontrado:', contacts?.length ? 'SIM' : 'NÃO');

    // Verificar fila de processamento
    const { data: queue } = await supabase
      .from('nina_processing_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('[Test] Itens na fila Nina:', queue?.length || 0);

    // Verificar fila de grouping
    const { data: groupingQueue } = await supabase
      .from('message_grouping_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('[Test] Itens na fila de grouping:', groupingQueue?.length || 0);

    console.log('═══════════════════════════════════════════');
    console.log('[Test] ✅ TESTE CONCLUÍDO');
    console.log('═══════════════════════════════════════════');

    return new Response(JSON.stringify({
      success: true,
      test_phone: testPhone,
      test_message: testMessage,
      webhook_response: {
        status: webhookResponse.status,
        body: webhookResult
      },
      database_check: {
        messages_found: messages?.length || 0,
        latest_message: messages?.[0] || null,
        contact_exists: (contacts?.length || 0) > 0,
        nina_queue_items: queue?.length || 0,
        grouping_queue_items: groupingQueue?.length || 0
      },
      settings_check: {
        meta_api_enabled: settings?.meta_api_enabled,
        meta_phone_number_id: settings?.meta_phone_number_id ? 'CONFIGURADO' : 'NÃO',
        meta_access_token: settings?.meta_access_token ? 'CONFIGURADO' : 'NÃO',
        meta_app_secret: settings?.meta_app_secret ? 'CONFIGURADO' : 'NÃO',
        message_grouping_enabled: settings?.message_grouping_enabled
      },
      instructions: [
        '1. Verifique os logs acima para ver o fluxo completo',
        '2. Se messages_found > 0, o webhook está funcionando',
        '3. Se nina_queue_items > 0 ou grouping_queue_items > 0, a IA irá processar',
        '4. Se tudo estiver 0, verifique a configuração do webhook no Meta'
      ]
    }, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Test] ❌ ERRO:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
