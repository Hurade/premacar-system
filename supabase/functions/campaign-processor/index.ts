import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Campaign {
  id: string;
  name: string;
  template_id: string;
  meta_template_id: string | null;
  status: string;
  daily_limit: number;
  interval_type: string;
  interval_min: number;
  interval_max: number;
  business_hours_enabled: boolean;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  anti_ban_enabled: boolean;
  pause_after_count: number;
  pause_duration_minutes: number;
  scheduled_start: string | null;
  sent_today: number;
  total_sent: number;
  paused_until: string | null;
  api_source: 'meta' | 'evolution';
  tag_on_delivered: string | null;
  tag_on_no_whatsapp: string | null;
}

interface Lead {
  id: string;
  campaign_id: string;
  phone: string;
  name: string | null;
  company: string | null;
  city: string | null;
  product: string | null;
  custom1: string | null;
  custom2: string | null;
  custom3: string | null;
  status: string;
  variation_used: number | null;
}

interface Template {
  id: string;
  variations: string[];
  media_type: string;
  media_urls: string[];
}

interface MetaTemplate {
  id: string;
  name: string;
  display_name: string;
  category: string;
  language_code: string;
  body_text: string;
  header_text: string | null;
  footer_text: string | null;
  parameters_count: number;
  parameters_mapping: Array<{index: number; field: string}>;
}

interface NinaSettings {
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  meta_phone_number_id: string | null;
  meta_access_token: string | null;
  timezone: string;
}

// Função para enviar template via Meta API
async function sendTemplateViaMeta(
  phoneNumber: string,
  metaTemplate: MetaTemplate,
  lead: Lead,
  settings: NinaSettings
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `https://graph.facebook.com/v21.0/${settings.meta_phone_number_id}/messages`;
  
  // Formatar número: remover caracteres especiais e adicionar código do país
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
  
  console.log('[Meta Template] Enviando template');
  console.log('[Meta Template] Para:', formattedPhone);
  console.log('[Meta Template] Template:', metaTemplate.name);
  
  // Mapear parâmetros do lead para o template
  const parameters: { type: string; text: string }[] = [];
  
  if (metaTemplate.parameters_mapping && metaTemplate.parameters_mapping.length > 0) {
    // Usar mapeamento configurado
    for (const mapping of metaTemplate.parameters_mapping) {
      let value = '';
      switch (mapping.field) {
        case 'name': value = lead.name || 'Cliente'; break;
        case 'company': value = lead.company || ''; break;
        case 'city': value = lead.city || ''; break;
        case 'product': value = lead.product || ''; break;
        case 'custom1': value = lead.custom1 || ''; break;
        case 'custom2': value = lead.custom2 || ''; break;
        case 'custom3': value = lead.custom3 || ''; break;
        default: value = lead.name || 'Cliente';
      }
      parameters.push({ type: 'text', text: value || 'Cliente' });
    }
  } else if (metaTemplate.parameters_count > 0) {
    // Fallback: usar nome como primeiro parâmetro
    for (let i = 0; i < metaTemplate.parameters_count; i++) {
      if (i === 0) {
        parameters.push({ type: 'text', text: lead.name || 'Cliente' });
      } else {
        parameters.push({ type: 'text', text: '' });
      }
    }
  }
  
  console.log('[Meta Template] Parâmetros:', parameters);
  
  // Construir payload do template
  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'template',
    template: {
      name: metaTemplate.name,
      language: {
        code: metaTemplate.language_code || 'pt_BR'
      },
      components: parameters.length > 0 ? [
        {
          type: 'body',
          parameters: parameters
        }
      ] : []
    }
  };
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.meta_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Meta Template] Erro na resposta:', data);
      return {
        success: false,
        error: data.error?.message || 'Erro ao enviar template Meta'
      };
    }
    
    console.log('[Meta Template] Sucesso:', data);
    return {
      success: true,
      messageId: data.messages?.[0]?.id
    };
    
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('[Meta Template] Erro ao enviar:', error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

// Função para enviar mensagem via Evolution API
async function sendMessageViaEvolution(
  phoneNumber: string,
  message: string,
  settings: NinaSettings
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const evolutionUrl = `${settings.evolution_api_url}/message/sendText/${settings.evolution_instance_name}`;
  
  try {
    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": settings.evolution_api_key!,
      },
      body: JSON.stringify({
        number: phoneNumber,
        text: message,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: responseData.message || "Evolution API error"
      };
    }

    return {
      success: true,
      messageId: responseData.key?.id || null
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return {
      success: false,
      error: errorMessage
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[campaign-processor] Starting campaign processing...");

    // Get nina settings for API configs
    const { data: settings } = await supabase
      .from("nina_settings")
      .select("evolution_api_url, evolution_api_key, evolution_instance_name, meta_phone_number_id, meta_access_token, timezone")
      .limit(1)
      .single();

    const ninaSettings = settings as NinaSettings;
    const timezone = ninaSettings?.timezone || 'America/Sao_Paulo';
    
    // Obter hora atual no fuso horário correto (Brasil por padrão)
    const now = new Date();
    const localTimeStr = now.toLocaleString('en-US', { timeZone: timezone });
    const localDate = new Date(localTimeStr);
    
    const currentHour = localDate.getHours();
    const currentMinute = localDate.getMinutes();
    const currentDay = localDate.getDay();
    
    console.log(`[campaign-processor] Timezone: ${timezone}, Local time: ${currentHour}:${currentMinute.toString().padStart(2, '0')}, Day: ${currentDay}`);

    // Get all active campaigns
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("status", "active");

    if (campaignsError) {
      throw campaignsError;
    }

    console.log(`[campaign-processor] Found ${campaigns?.length || 0} active campaigns`);

    const results: { campaignId: string; sent: boolean; reason?: string }[] = [];

    // Circuit breaker: track consecutive errors per campaign
    const consecutiveErrors: Record<string, number> = {};

    for (const campaign of campaigns || []) {
      const campaignData = campaign as Campaign;
      console.log(`[campaign-processor] Processing campaign: ${campaignData.name} (API: ${campaignData.api_source})`);

      // Verificar configuração da API baseada na fonte
      if (campaignData.api_source === 'meta') {
        if (!ninaSettings?.meta_phone_number_id || !ninaSettings?.meta_access_token) {
          console.log(`[campaign-processor] Meta API not configured for campaign ${campaignData.name}`);
          results.push({ campaignId: campaignData.id, sent: false, reason: "meta_api_not_configured" });
          continue;
        }
      } else {
        if (!ninaSettings?.evolution_api_url || !ninaSettings?.evolution_api_key || !ninaSettings?.evolution_instance_name) {
          console.log(`[campaign-processor] Evolution API not configured for campaign ${campaignData.name}`);
          results.push({ campaignId: campaignData.id, sent: false, reason: "evolution_api_not_configured" });
          continue;
        }
      }

      // Check if scheduled start is in the future
      if (campaignData.scheduled_start && new Date(campaignData.scheduled_start) > now) {
        results.push({ campaignId: campaignData.id, sent: false, reason: "scheduled_start_not_reached" });
        continue;
      }

      // Check daily limit
      if (campaignData.sent_today >= campaignData.daily_limit) {
        results.push({ campaignId: campaignData.id, sent: false, reason: "daily_limit_reached" });
        continue;
      }

      // Check business hours
      if (campaignData.business_hours_enabled) {
        const [startHour, startMin] = campaignData.business_hours_start.split(":").map(Number);
        const [endHour, endMin] = campaignData.business_hours_end.split(":").map(Number);
        const currentTimeMinutes = currentHour * 60 + currentMinute;
        const startTimeMinutes = startHour * 60 + startMin;
        const endTimeMinutes = endHour * 60 + endMin;

        if (currentTimeMinutes < startTimeMinutes || currentTimeMinutes > endTimeMinutes) {
          results.push({ campaignId: campaignData.id, sent: false, reason: "outside_business_hours" });
          continue;
        }

        if (!campaignData.business_days.includes(currentDay)) {
          results.push({ campaignId: campaignData.id, sent: false, reason: "not_business_day" });
          continue;
        }
      }

      // Check anti-ban pause
      if (campaignData.paused_until && new Date(campaignData.paused_until) > now) {
        results.push({ campaignId: campaignData.id, sent: false, reason: "anti_ban_pause" });
        continue;
      }

      // Get next pending lead
      const { data: leads, error: leadsError } = await supabase
        .from("campaign_leads")
        .select("*")
        .eq("campaign_id", campaignData.id)
        .eq("status", "pending")
        .order("id")
        .limit(1);

      if (leadsError) {
        console.error(`[campaign-processor] Error fetching leads: ${leadsError.message}`);
        continue;
      }

      if (!leads || leads.length === 0) {
        // No more leads, mark campaign as completed
        await supabase
          .from("campaigns")
          .update({ status: "completed" })
          .eq("id", campaignData.id);

        results.push({ campaignId: campaignData.id, sent: false, reason: "no_pending_leads" });
        continue;
      }

      const lead = leads[0] as Lead;
      let message = "";
      let sendResult: { success: boolean; messageId?: string; error?: string };

      // Lógica diferente para Meta vs Evolution
      if (campaignData.api_source === 'meta') {
        // Para Meta: usar template aprovado
        if (!campaignData.meta_template_id) {
          console.error(`[campaign-processor] Campaign ${campaignData.name} uses Meta API but has no meta_template_id`);
          results.push({ campaignId: campaignData.id, sent: false, reason: "no_meta_template" });
          continue;
        }

        // Buscar meta template
        const { data: metaTemplate, error: metaTemplateError } = await supabase
          .from("meta_templates")
          .select("*")
          .eq("id", campaignData.meta_template_id)
          .single();

        if (metaTemplateError || !metaTemplate) {
          console.error(`[campaign-processor] Meta template not found: ${campaignData.meta_template_id}`);
          results.push({ campaignId: campaignData.id, sent: false, reason: "meta_template_not_found" });
          continue;
        }

        const metaTemplateData = metaTemplate as MetaTemplate;
        
        // Verificar se template está aprovado
        if (metaTemplate.status !== 'approved') {
          console.error(`[campaign-processor] Meta template not approved: ${metaTemplateData.name}`);
          results.push({ campaignId: campaignData.id, sent: false, reason: "meta_template_not_approved" });
          continue;
        }

        console.log(`[campaign-processor] Sending template "${metaTemplateData.name}" to ${lead.phone}`);

        // Enviar via Meta Template API
        sendResult = await sendTemplateViaMeta(lead.phone, metaTemplateData, lead, ninaSettings);
        
        // Gerar mensagem para log (substituir variáveis no body_text)
        message = metaTemplateData.body_text
          .replace(/\{\{1\}\}/g, lead.name || 'Cliente')
          .replace(/\{\{2\}\}/g, lead.company || '')
          .replace(/\{\{3\}\}/g, lead.city || '')
          .replace(/\{\{4\}\}/g, lead.product || '');

      } else {
        // Para Evolution: usar message_templates existente
        const { data: template, error: templateError } = await supabase
          .from("message_templates")
          .select("*")
          .eq("id", campaignData.template_id)
          .single();

        if (templateError || !template) {
          console.error(`[campaign-processor] Template not found: ${campaignData.template_id}`);
          continue;
        }

        const templateData = template as Template;
        const variations = templateData.variations as string[];

        if (!variations || variations.length === 0) {
          console.error(`[campaign-processor] Template has no variations`);
          continue;
        }

        // Select random variation
        const variationIndex = Math.floor(Math.random() * variations.length);
        message = variations[variationIndex];

        // Replace variables
        message = message
          .replace(/{nome}/g, lead.name || "")
          .replace(/{empresa}/g, lead.company || "")
          .replace(/{cidade}/g, lead.city || "")
          .replace(/{produto}/g, lead.product || "")
          .replace(/{custom1}/g, lead.custom1 || "")
          .replace(/{custom2}/g, lead.custom2 || "")
          .replace(/{custom3}/g, lead.custom3 || "");

        // Clean up extra spaces from empty variables
        message = message.replace(/\s+/g, " ").trim();

        console.log(`[campaign-processor] Sending to ${lead.phone}: ${message.substring(0, 50)}...`);

        // Enviar via Evolution API
        sendResult = await sendMessageViaEvolution(lead.phone, message, ninaSettings);
      }

      // Processar resultado do envio
      if (sendResult.success) {
        // Update lead status
        await supabase
          .from("campaign_leads")
          .update({
            status: "sent",
            variation_used: 0,
            sent_at: new Date().toISOString(),
            whatsapp_message_id: sendResult.messageId || null,
          })
          .eq("id", lead.id);

        // ===== Criar/atualizar contato e criar mensagem no chat =====
        let contactId: string | null = null;
        
        // Normalizar número para busca: tentar com e sem dígito 9 extra (Brasil)
        const cleanLeadPhone = lead.phone.replace(/\D/g, '');
        let phoneVariants = [cleanLeadPhone];
        // Se número tem 13 dígitos (55 + DDD + 9 + número), tentar sem o 9
        if (cleanLeadPhone.length === 13 && cleanLeadPhone.startsWith('55')) {
          const withoutNinth = cleanLeadPhone.slice(0, 4) + cleanLeadPhone.slice(5);
          phoneVariants.push(withoutNinth);
        }
        // Se número tem 12 dígitos (55 + DDD + número), tentar com o 9
        if (cleanLeadPhone.length === 12 && cleanLeadPhone.startsWith('55')) {
          const withNinth = cleanLeadPhone.slice(0, 4) + '9' + cleanLeadPhone.slice(4);
          phoneVariants.push(withNinth);
        }
        console.log(`[campaign-processor] Buscando contato para variantes de telefone:`, phoneVariants);
        
        const { data: existingContacts } = await supabase
          .from("contacts")
          .select("id, tags, phone_number")
          .in("phone_number", phoneVariants);
        
        const existingContact = existingContacts && existingContacts.length > 0 ? existingContacts[0] : null;

        if (existingContact) {
          contactId = existingContact.id;
          
          // Build tags to apply
          const currentTags = (existingContact.tags as string[]) || [];
          const newTags = [...currentTags];
          
          // Aplicar tag de entrega se configurada
          if (campaignData.tag_on_delivered && !newTags.includes(campaignData.tag_on_delivered)) {
            newTags.push(campaignData.tag_on_delivered);
            console.log(`[campaign-processor] Tag "${campaignData.tag_on_delivered}" será aplicada ao contato ${contactId}`);
          }
          
          // AUTO-TAG: Adicionar tag do template Meta automaticamente (ex: template_cris_posvenda)
          if (campaignData.api_source === 'meta' && campaignData.meta_template_id) {
            // Buscar nome do template Meta para gerar a tag
            const { data: metaTemplateForTag } = await supabase
              .from("meta_templates")
              .select("name")
              .eq("id", campaignData.meta_template_id)
              .single();
            
            if (metaTemplateForTag) {
              const templateTag = `template_${metaTemplateForTag.name}`;
              if (!newTags.includes(templateTag)) {
                newTags.push(templateTag);
                console.log(`[campaign-processor] Auto-tag "${templateTag}" será aplicada ao contato ${contactId}`);
              }
            }
          }
          
          // Atualizar tags se houve mudanças
          if (newTags.length > currentTags.length) {
            await supabase
              .from("contacts")
              .update({ 
                tags: newTags,
                last_activity: new Date().toISOString()
              })
              .eq("id", contactId);
            console.log(`[campaign-processor] Tags atualizadas para contato ${contactId}:`, newTags);
          }
        } else {
          // Criar novo contato com tags
          const tagsToApply = campaignData.tag_on_delivered ? [campaignData.tag_on_delivered] : [];
          
          // AUTO-TAG para novo contato também
          if (campaignData.api_source === 'meta' && campaignData.meta_template_id) {
            const { data: metaTemplateForTag } = await supabase
              .from("meta_templates")
              .select("name")
              .eq("id", campaignData.meta_template_id)
              .single();
            
            if (metaTemplateForTag) {
              const templateTag = `template_${metaTemplateForTag.name}`;
              if (!tagsToApply.includes(templateTag)) {
                tagsToApply.push(templateTag);
                console.log(`[campaign-processor] Auto-tag "${templateTag}" para novo contato`);
              }
            }
          }
          
          const { data: newContact } = await supabase
            .from("contacts")
            .insert({
              phone_number: lead.phone,
              name: lead.name || null,
              oficina: lead.company || null,
              last_activity: new Date().toISOString(),
              tags: tagsToApply,
            })
            .select("id")
            .single();
          
          if (newContact) {
            contactId = newContact.id;
            if (tagsToApply.length > 0) {
              console.log(`[campaign-processor] Novo contato criado com tag "${campaignData.tag_on_delivered}"`);
            }
          }
        }

        if (contactId) {
          // Buscar ou criar conversa
          let conversationId: string | null = null;
          const { data: existingConv } = await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contactId)
            .eq("is_active", true)
            .eq("api_source", campaignData.api_source)
            .maybeSingle();

          if (existingConv) {
            conversationId = existingConv.id;
            // Atualizar last_message_at e dispatch_sent_at (novo disparo = reiniciar delay)
            await supabase
              .from("conversations")
              .update({ 
                last_message_at: new Date().toISOString(),
                dispatch_sent_at: new Date().toISOString()
              })
              .eq("id", conversationId);
            console.log(`[campaign-processor] Conversa existente atualizada com novo dispatch_sent_at`);
          } else {
            // Criar nova conversa com dispatch_sent_at para controle do delay
            const { data: newConv } = await supabase
              .from("conversations")
              .insert({
                contact_id: contactId,
                status: "nina", // IA ativa para responder quando o contato responder
                last_message_at: new Date().toISOString(),
                api_source: campaignData.api_source,
                dispatch_sent_at: new Date().toISOString(), // Registrar timestamp do disparo
              })
              .select("id")
              .single();
            
            if (newConv) {
              conversationId = newConv.id;
              console.log(`[campaign-processor] Conversa criada com dispatch_sent_at para delay de IA`);
            }
          }

          if (conversationId) {
            // Criar mensagem no histórico
            await supabase
              .from("messages")
              .insert({
                conversation_id: conversationId,
                content: message,
                from_type: "nina",
                type: "text",
                status: "sent",
                sent_at: new Date().toISOString(),
                whatsapp_message_id: sendResult.messageId || null,
                api_source: campaignData.api_source,
                metadata: {
                  campaign_id: campaignData.id,
                  campaign_name: campaignData.name,
                  is_broadcast: true,
                  is_template: campaignData.api_source === 'meta',
                },
              });
            
            console.log(`[campaign-processor] Message saved to chat for conversation ${conversationId}`);
          }
        }

        // Update campaign counters
        const newSentToday = campaignData.sent_today + 1;
        const newTotalSent = campaignData.total_sent + 1;

        const updateData: Record<string, unknown> = {
          sent_today: newSentToday,
          total_sent: newTotalSent,
          last_sent_at: new Date().toISOString(),
        };

        // Anti-ban: check if we need to pause
        if (campaignData.anti_ban_enabled && campaignData.pause_after_count > 0) {
          if (newTotalSent % campaignData.pause_after_count === 0) {
            const pauseUntil = new Date(now.getTime() + campaignData.pause_duration_minutes * 60000);
            updateData.paused_until = pauseUntil.toISOString();
            console.log(`[campaign-processor] Anti-ban pause until ${pauseUntil.toISOString()}`);
          }
        }

        await supabase
          .from("campaigns")
          .update(updateData)
          .eq("id", campaignData.id);

        results.push({ campaignId: campaignData.id, sent: true });
        console.log(`[campaign-processor] Successfully sent message to ${lead.phone}`);

      } else {
        console.error(`[campaign-processor] Error sending message: ${sendResult.error}`);

        const errorLower = sendResult.error?.toLowerCase() || '';

        // Classify error as definitive (no retry) vs retryable
        const isDefinitiveError = 
          errorLower.includes('ecosystem engagement') ||
          errorLower.includes('131049') ||
          errorLower.includes('undeliverable') ||
          errorLower.includes('not a valid whatsapp') ||
          errorLower.includes('not registered') ||
          errorLower.includes('número inválido') ||
          errorLower.includes('recipient') ||
          errorLower.includes('invalid');

        const isNotWhatsAppError = errorLower.includes('not a valid whatsapp') ||
          errorLower.includes('invalid') ||
          errorLower.includes('not registered') ||
          errorLower.includes('número inválido') ||
          errorLower.includes('recipient') ||
          errorLower.includes('undeliverable');

        // Aplicar tag de "sem WhatsApp" se configurada e aplicável
        if (isNotWhatsAppError && campaignData.tag_on_no_whatsapp) {
          const { data: existingContact } = await supabase
            .from("contacts")
            .select("id, tags")
            .eq("phone_number", lead.phone)
            .maybeSingle();

          if (existingContact) {
            const currentTags = (existingContact.tags as string[]) || [];
            if (!currentTags.includes(campaignData.tag_on_no_whatsapp)) {
              await supabase
                .from("contacts")
                .update({ 
                  tags: [...currentTags, campaignData.tag_on_no_whatsapp]
                })
                .eq("id", existingContact.id);
              console.log(`[campaign-processor] Tag "${campaignData.tag_on_no_whatsapp}" aplicada ao contato sem WhatsApp`);
            }
          }
        }

        // Update lead: definitive errors go straight to 'error', retryable can retry up to 2x
        const attempts = (lead as Lead & { attempts?: number }).attempts || 0;
        const newStatus = isDefinitiveError ? 'error' : (attempts >= 2 ? 'error' : 'pending');
        
        await supabase
          .from("campaign_leads")
          .update({
            status: newStatus,
            error_message: sendResult.error,
            attempts: attempts + 1,
          })
          .eq("id", lead.id);

        if (isDefinitiveError) {
          console.log(`[campaign-processor] Definitive error - lead marked as error immediately (no retry)`);
        }

        // Update campaign error count
        await supabase.rpc('increment_campaign_counter', { 
          p_campaign_id: campaignData.id, 
          p_counter: 'total_errors' 
        });

        // Circuit breaker: track consecutive errors
        consecutiveErrors[campaignData.id] = (consecutiveErrors[campaignData.id] || 0) + 1;
        console.log(`[campaign-processor] Consecutive errors for ${campaignData.name}: ${consecutiveErrors[campaignData.id]}`);

        if (consecutiveErrors[campaignData.id] >= 5) {
          console.error(`[campaign-processor] CIRCUIT BREAKER: 5+ consecutive errors for "${campaignData.name}" - auto-pausing campaign`);
          await supabase
            .from("campaigns")
            .update({ 
              status: 'paused',
              description: `${campaignData.description || ''}\n[Auto-pausada em ${new Date().toISOString()}: ${consecutiveErrors[campaignData.id]} erros consecutivos - "${sendResult.error}"]`.trim()
            })
            .eq("id", campaignData.id);
        }

        results.push({ campaignId: campaignData.id, sent: false, reason: sendResult.error });
      }
    }

    // Safety net: auto-complete any campaigns that somehow still have 'active' status but 0 pending leads
    for (const campaign of campaigns || []) {
      const campaignData = campaign as Campaign;
      const { count } = await supabase
        .from("campaign_leads")
        .select("id", { count: 'exact', head: true })
        .eq("campaign_id", campaignData.id)
        .eq("status", "pending");

      if (count === 0 && campaignData.status === 'active') {
        await supabase
          .from("campaigns")
          .update({ status: 'completed' })
          .eq("id", campaignData.id);
        console.log(`[campaign-processor] Campaign "${campaignData.name}" auto-completed (safety net - no pending leads)`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("[campaign-processor] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});