import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { saveLog } from "../_shared/logger.ts";
import { resolveSendCredentials, SendCredentials } from "../_shared/connection-resolver.ts";
import { selectVariation, CampaignVariationLike } from "../_shared/campaign-variations.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional: process specific campaign
    let targetCampaignId: string | null = null;
    try {
      const body = await req.json();
      targetCampaignId = body.campaign_id || null;
    } catch { /* no body */ }

    console.log("[recurring-processor] Starting...", targetCampaignId ? `Campaign: ${targetCampaignId}` : "All active");

    // Get active recurring campaigns
    let query = supabase
      .from("recurring_campaigns")
      .select("*")
      .eq("status", "active");

    if (targetCampaignId) {
      query = query.eq("id", targetCampaignId);
    }

    const { data: campaigns, error: campaignsError } = await query;
    if (campaignsError) throw campaignsError;

    console.log(`[recurring-processor] Found ${campaigns?.length || 0} campaigns`);

    // Get integration settings for email configs.
    // Prefer the row that has SES enabled; fall back to any row so errors are descriptive.
    let integrationSettings: any = null;
    const { data: sesRow } = await supabase
      .from("integration_settings")
      .select("aws_access_key_id, aws_secret_access_key, aws_region, aws_ses_email_from, aws_ses_email_from_name, aws_ses_enabled")
      .eq("aws_ses_enabled", true)
      .limit(1)
      .maybeSingle();
    if (sesRow) {
      integrationSettings = sesRow;
    } else {
      const { data: anyRow } = await supabase
        .from("integration_settings")
        .select("aws_access_key_id, aws_secret_access_key, aws_region, aws_ses_email_from, aws_ses_email_from_name, aws_ses_enabled")
        .limit(1)
        .maybeSingle();
      integrationSettings = anyRow;
    }

    const results: any[] = [];

    for (const campaign of campaigns || []) {
      const flowConfig = campaign.flow_config as Record<string, any>;
      const now2 = new Date();

      // scheduled_start: campanha só começa a processar contatos a partir
      // dessa data/hora, não importa quando foi ativada nem quando os
      // contatos entraram (campaign_contacts.created_at pode ser muito
      // antes). Sem isso, não havia como agendar o "dia 1" pra uma data
      // específica no calendário — coluna existia mas nunca era lida aqui.
      if (campaign.scheduled_start && new Date(campaign.scheduled_start) > now2) {
        results.push({ campaign_id: campaign.id, name: campaign.name, sent: 0, failed: 0, reason: "scheduled_start_not_reached" });
        continue;
      }

      // ── Paginação anti-ban (portado do campaign-processor/Disparos) ──
      // anti_ban_enabled nasce false: campanhas já existentes (poucos
      // contatos/dia) continuam disparando na hora, sem esses gates.
      let sendRules: any = null;
      if (campaign.anti_ban_enabled) {
        if (campaign.paused_until && new Date(campaign.paused_until) > now2) {
          results.push({ campaign_id: campaign.id, name: campaign.name, sent: 0, failed: 0, reason: "anti_ban_pause" });
          continue;
        }

        if (campaign.business_hours_enabled) {
          const localTimeStr = now2.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" });
          const localDate = new Date(localTimeStr);
          const [startHour, startMin] = (campaign.business_hours_start || "09:00").split(":").map(Number);
          const [endHour, endMin] = (campaign.business_hours_end || "18:00").split(":").map(Number);
          const currentTimeMinutes = localDate.getHours() * 60 + localDate.getMinutes();
          const startTimeMinutes = startHour * 60 + startMin;
          const endTimeMinutes = endHour * 60 + endMin;
          const businessDays: number[] = campaign.business_days || [1, 2, 3, 4, 5];

          if (
            currentTimeMinutes < startTimeMinutes ||
            currentTimeMinutes > endTimeMinutes ||
            !businessDays.includes(localDate.getDay())
          ) {
            results.push({ campaign_id: campaign.id, name: campaign.name, sent: 0, failed: 0, reason: "outside_business_hours" });
            continue;
          }
        }

        if ((campaign.sent_today || 0) >= (campaign.daily_limit || 100)) {
          results.push({ campaign_id: campaign.id, name: campaign.name, sent: 0, failed: 0, reason: "daily_limit_reached" });
          continue;
        }

        const { data: rulesRow } = await supabase
          .from("recurring_campaign_send_rules")
          .select("*")
          .eq("campaign_id", campaign.id)
          .maybeSingle();
        sendRules = rulesRow;

        if (sendRules?.auto_pause_on_errors) {
          const windowSize = sendRules.error_window_sends || 30;
          const { data: recentSends } = await supabase
            .from("system_logs")
            .select("metadata")
            .eq("source", "recurring-campaign-processor")
            .contains("metadata", { campaign_id: campaign.id, type: "whatsapp" })
            .order("created_at", { ascending: false })
            .limit(windowSize);

          if (recentSends && recentSends.length >= windowSize) {
            const errors = recentSends.filter((l: any) => l.metadata?.success === false).length;
            const errorRatePct = (errors / recentSends.length) * 100;
            if (errorRatePct >= (sendRules.error_rate_threshold || 15)) {
              const pauseUntil = new Date(Date.now() + (sendRules.pause_duration_minutes || 60) * 60_000).toISOString();
              await supabase
                .from("recurring_campaigns")
                .update({ status: "paused", paused_until: pauseUntil })
                .eq("id", campaign.id);
              await saveLog(supabase, {
                source: "recurring-campaign-processor",
                level: "warn",
                message: `Auto-pause anti-bloqueio: ${campaign.name} (${errorRatePct.toFixed(1)}% erros)`,
                metadata: { campaign_id: campaign.id, error_rate: errorRatePct, threshold: sendRules.error_rate_threshold },
              });
              results.push({ campaign_id: campaign.id, name: campaign.name, sent: 0, failed: 0, reason: "auto_paused_error_rate" });
              continue;
            }
          }
        }
      }

      // Variações A/B ativas (independe de anti_ban_enabled)
      const { data: variationsData } = await supabase
        .from("recurring_campaign_variations")
        .select("*")
        .eq("campaign_id", campaign.id)
        .eq("is_active", true)
        .order("label");
      const variations = (variationsData ?? []) as (CampaignVariationLike & { meta_template_id: string | null })[];

      // Get in_progress contacts for this campaign
      const { data: contacts, error: contactsError } = await supabase
        .from("campaign_contacts")
        .select("id, contact_id, current_day, status, day_statuses, metadata, created_at")
        .eq("campaign_id", campaign.id)
        .eq("status", "in_progress");

      if (contactsError) {
        console.error(`[recurring-processor] Error fetching contacts:`, contactsError);
        continue;
      }

      if (!contacts || contacts.length === 0) {
        console.log(`[recurring-processor] No in_progress contacts for campaign ${campaign.name}`);
        // Mark campaign completed if no contacts left
        await supabase
          .from("recurring_campaigns")
          .update({ status: "completed", ended_at: new Date().toISOString() })
          .eq("id", campaign.id);
        continue;
      }

      console.log(`[recurring-processor] Processing ${contacts.length} contacts for "${campaign.name}"`);

      let sentCount = 0;
      let failedCount = 0;
      let whatsappSentThisTick = false;
      let sentTodayDelta = 0;
      // E-mail não tinha NENHUM limite por execução (só WhatsApp tem, via
      // whatsappSentThisTick) — com scheduled_start liberando centenas/
      // milhares de contatos de uma vez no mesmo "dia 1", a primeira
      // execução depois do horário agendado tentava mandar todos os
      // e-mails na mesma invocação (risco de estourar limite de taxa do
      // SES e parecer disparo em massa pra reputação do remetente). Sem o
      // anti-ban do WhatsApp (não há risco de bloqueio de número), um teto
      // mais alto por execução já resolve, espalhando o envio ao longo de
      // ~1h em vez de uma rajada só.
      let emailsSentThisTick = 0;
      const EMAIL_PER_TICK_CAP = 25;

      for (const cc of contacts) {
        const dayKey = `day${cc.current_day}`;
        const dayConfig = flowConfig[dayKey];

        if (!dayConfig || !dayConfig.enabled) {
          console.log(`[recurring-processor] Day ${cc.current_day} not configured or disabled, skipping`);
          continue;
        }

        // Check if already processed today
        const dayStatuses = (cc.day_statuses as Record<string, any>) || {};
        if (dayStatuses[dayKey]?.sent_at) {
          console.log(`[recurring-processor] Day ${cc.current_day} already sent for contact ${cc.contact_id}`);
          continue;
        }

        // Momento em que o contato ficou elegível pro dia atual: sent_at do
        // dia anterior, ou created_at (entrada na campanha) se for o dia 1.
        const prevDayKey = `day${cc.current_day - 1}`;
        const eligibleSince = new Date(dayStatuses[prevDayKey]?.sent_at || cc.created_at);

        // Respeita o atraso configurado (timing.hours) entre dias — sem
        // isso todos os dias disparavam em sequência, em minutos.
        if (dayConfig.timing?.type === "delay" && dayConfig.timing?.hours) {
          const readyAt = new Date(eligibleSince.getTime() + dayConfig.timing.hours * 3_600_000);
          if (now2 < readyAt) {
            continue; // ainda não chegou a hora — tenta de novo no próximo tick
          }
        }

        // Para a cadência se o contato já respondeu desde o último envio —
        // evita mandar o dia seguinte pra quem já engajou.
        const { data: reply } = await supabase
          .from("messages")
          .select("id, conversations!inner(contact_id)")
          .eq("conversations.contact_id", cc.contact_id)
          .eq("from_type", "user")
          .gt("sent_at", eligibleSince.toISOString())
          .limit(1)
          .maybeSingle();

        if (reply) {
          console.log(`[recurring-processor] Contato ${cc.contact_id} respondeu — parando cadência (sucesso)`);
          await supabase
            .from("campaign_contacts")
            .update({
              status: "success",
              success_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              metadata: { ...(cc.metadata || {}), stopped_reason: "replied" },
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", cc.id);
          sentCount++;
          continue;
        }

        // Get contact details
        const { data: contact } = await supabase
          .from("contacts")
          .select("id, name, call_name, phone_number, email, oficina, is_blocked, tags")
          .eq("id", cc.contact_id)
          .single();

        if (!contact) {
          console.error(`[recurring-processor] Contact not found: ${cc.contact_id}`);
          failedCount++;
          continue;
        }

        if (contact.is_blocked) {
          console.log(`[recurring-processor] Contato bloqueado, cancelando na campanha: ${contact.id}`);
          await supabase
            .from("campaign_contacts")
            .update({ status: "cancelled" })
            .eq("id", cc.id);
          continue;
        }

        // Tag "Free" (aplicada manualmente quando o contato cria conta no
        // plano Free) para a cadência — não tem webhook do produto Free
        // avisando o CRM de cadastro, essa tag é o jeito combinado de
        // registrar isso e interromper os envios.
        if (Array.isArray(contact.tags) && contact.tags.includes("Free")) {
          console.log(`[recurring-processor] Contato com tag "Free", parando cadência (sucesso): ${contact.id}`);
          await supabase
            .from("campaign_contacts")
            .update({
              status: "success",
              success_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              metadata: { ...(cc.metadata || {}), stopped_reason: "tag_free" },
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", cc.id);
          sentCount++;
          continue;
        }

        // Blacklist global do usuário (portado do campaign-processor/Disparos)
        if (dayConfig.type === "whatsapp" && contact.phone_number && campaign.user_id) {
          const { data: blocked } = await supabase
            .from("campaign_blacklist")
            .select("id")
            .eq("user_id", campaign.user_id)
            .eq("phone", contact.phone_number)
            .maybeSingle();
          if (blocked) {
            console.log(`[recurring-processor] Telefone na blacklist, cancelando na campanha: ${contact.phone_number}`);
            await supabase
              .from("campaign_contacts")
              .update({ status: "cancelled" })
              .eq("id", cc.id);
            continue;
          }
        }

        // Paginação anti-ban: no máximo 1 envio de WhatsApp por execução
        // do cron quando a campanha tem anti_ban_enabled — mesmo modelo
        // do campaign-processor (1 lead pendente por tick).
        if (dayConfig.type === "whatsapp" && campaign.anti_ban_enabled && whatsappSentThisTick) {
          console.log(`[recurring-processor] Anti-ban: já enviou 1 WhatsApp nesta execução para "${campaign.name}", contato ${cc.contact_id} fica pra próxima`);
          continue;
        }

        if (dayConfig.type === "email" && emailsSentThisTick >= EMAIL_PER_TICK_CAP) {
          console.log(`[recurring-processor] Limite de ${EMAIL_PER_TICK_CAP} e-mails desta execução atingido para "${campaign.name}", contato ${cc.contact_id} fica pra próxima`);
          continue;
        }

        const contactName = contact.name || contact.call_name || "Cliente";
        let sendResult = { success: false, error: "" };
        let selectedVariation: (CampaignVariationLike & { meta_template_id: string | null }) | null = null;

        try {
          if (dayConfig.type === "email") {
            sendResult = await sendEmail(contact, dayConfig, integrationSettings);
            if (sendResult.success) emailsSentThisTick++;
          } else if (dayConfig.type === "whatsapp") {
            // Resolve credenciais via shared resolver (mesmo que campaign-processor/Disparos usa)
            // Prefere Meta; se Meta não configurado, tenta Evolution
            let whatsappCreds: SendCredentials;
            try {
              whatsappCreds = await resolveSendCredentials(supabase, {
                connectionId: campaign.connection_id ?? null,
                apiSource: "meta",
              });
            } catch {
              whatsappCreds = await resolveSendCredentials(supabase, {
                connectionId: campaign.connection_id ?? null,
                apiSource: "evolution",
              });
            }
            console.log(`[recurring-processor] WhatsApp creds resolved: api_type=${whatsappCreds.api_type}, campaign=${campaign.name}`);

            // Seleção A/B: variação escolhida substitui o meta_template_id do dia
            let effectiveDayConfig = dayConfig;
            if (variations.length > 0) {
              const { variation } = selectVariation(variations);
              selectedVariation = variation;
              console.log(`[recurring-processor] A/B: variação "${variation.label}" selecionada (peso ${variation.weight}%)`);
              if (variation.meta_template_id) {
                effectiveDayConfig = {
                  ...dayConfig,
                  config: { ...dayConfig.config, meta_template_id: variation.meta_template_id },
                };
              }
            }

            sendResult = await sendWhatsApp(contact, effectiveDayConfig, whatsappCreds, supabase);

            if (campaign.anti_ban_enabled && sendResult.success) {
              whatsappSentThisTick = true;
              sentTodayDelta++;
            }
          } else if (dayConfig.type === "sms") {
            sendResult = { success: false, error: "SMS não implementado ainda" };
          } else if (dayConfig.type === "call") {
            sendResult = await sendCall(contact, dayConfig, supabase, supabaseUrl);
          } else {
            sendResult = { success: false, error: `Tipo desconhecido: ${dayConfig.type}` };
          }
        } catch (err: any) {
          sendResult = { success: false, error: err.message || "Erro desconhecido" };
        }

        // Persist result to system_logs so it's queryable via SQL
        await saveLog(supabase, {
          source: "recurring-campaign-processor",
          level: sendResult.success ? "info" : "error",
          message: sendResult.success
            ? `Envio OK: ${dayConfig.type} → ${contactName} (campanha: ${campaign.name}, dia ${cc.current_day})`
            : `Falha: ${dayConfig.type} → ${contactName} (campanha: ${campaign.name}, dia ${cc.current_day}): ${sendResult.error}`,
          metadata: {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            contact_id: cc.contact_id,
            contact_name: contactName,
            contact_phone: contact.phone_number,
            day: cc.current_day,
            type: dayConfig.type,
            success: sendResult.success,
            error: sendResult.error || null,
          },
        });

        // Update day status
        const updatedDayStatuses = {
          ...dayStatuses,
          [dayKey]: {
            sent_at: new Date().toISOString(),
            success: sendResult.success,
            error: sendResult.success ? null : sendResult.error,
            type: dayConfig.type,
          },
        };

        if (sendResult.success) {
          sentCount++;
          console.log(`[recurring-processor] ✅ Sent ${dayConfig.type} to ${contactName} (Day ${cc.current_day})`);

          if (dayConfig.type === "whatsapp") {
            if (selectedVariation) {
              await supabase
                .from("recurring_campaign_variations")
                .update({ total_sent: selectedVariation.total_sent + 1, updated_at: new Date().toISOString() })
                .eq("id", selectedVariation.id);

              if (sendRules?.ab_auto_winner && !variations.some((v) => v.is_winner)) {
                const minSends = sendRules.ab_winner_min_sends || 100;
                if (variations.every((v) => v.total_sent >= minSends)) {
                  const { data: varMetrics } = await supabase
                    .from("recurring_campaign_variations")
                    .select("id, label, total_sent, total_delivered, total_read, total_replied")
                    .eq("campaign_id", campaign.id)
                    .eq("is_active", true);
                  if (varMetrics && varMetrics.length >= 2) {
                    const metric = sendRules.ab_winner_metric || "reply_rate";
                    const scored = varMetrics
                      .map((v: any) => ({
                        id: v.id,
                        label: v.label,
                        score:
                          metric === "reply_rate"
                            ? v.total_replied / Math.max(v.total_sent, 1)
                            : metric === "read_rate"
                            ? v.total_read / Math.max(v.total_sent, 1)
                            : v.total_delivered / Math.max(v.total_sent, 1),
                      }))
                      .sort((a: any, b: any) => b.score - a.score);
                    const winnerId = scored[0].id;
                    await supabase.from("recurring_campaign_variations").update({ is_winner: false }).eq("campaign_id", campaign.id);
                    await supabase.from("recurring_campaign_variations").update({ is_winner: true }).eq("id", winnerId);
                    await supabase.from("recurring_campaign_variations").update({ is_active: false }).eq("campaign_id", campaign.id).neq("id", winnerId);
                    console.log(`[recurring-processor] 🏆 Auto-winner: variação "${scored[0].label}" (métrica: ${metric})`);
                  }
                }
              }
            }

            // Auto-tag configurada no dia (tag_on_delivered), reaproveitando contacts.tags
            const tagOnDelivered = dayConfig.config?.tag_on_delivered as string | undefined;
            if (tagOnDelivered) {
              const { data: freshContact } = await supabase.from("contacts").select("tags").eq("id", contact.id).single();
              const currentTags = (freshContact?.tags as string[]) || [];
              if (!currentTags.includes(tagOnDelivered)) {
                await supabase
                  .from("contacts")
                  .update({ tags: [...currentTags, tagOnDelivered], last_activity: new Date().toISOString() })
                  .eq("id", contact.id);
              }
            }
          }

          // Check if this is the last day
          const nextDayKey = `day${cc.current_day + 1}`;
          const hasNextDay = flowConfig[nextDayKey] && flowConfig[nextDayKey].enabled;

          if (hasNextDay) {
            // Advance to next day
            await supabase
              .from("campaign_contacts")
              .update({
                current_day: cc.current_day + 1,
                day_statuses: updatedDayStatuses,
                connection_id: campaign.connection_id ?? null,
                updated_at: new Date().toISOString(),
              } as any)
              .eq("id", cc.id);
          } else {
            // Mark as success (completed all days)
            await supabase
              .from("campaign_contacts")
              .update({
                status: "success",
                day_statuses: updatedDayStatuses,
                connection_id: campaign.connection_id ?? null,
                success_at: new Date().toISOString(),
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              } as any)
              .eq("id", cc.id);
          }
        } else {
          failedCount++;
          console.error(`[recurring-processor] ❌ Failed ${dayConfig.type} to ${contactName}: ${sendResult.error}`);

          await supabase
            .from("campaign_contacts")
            .update({
              status: "failed",
              day_statuses: updatedDayStatuses,
              failed_reason: sendResult.error,
              completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            } as any)
            .eq("id", cc.id);
        }
      }

      // Update campaign counters
      await supabase
        .from("recurring_campaigns")
        .update({
          success_count: (campaign.success_count || 0) + sentCount,
          failed_count: (campaign.failed_count || 0) + failedCount,
          in_progress_count: Math.max(0, (campaign.in_progress_count || 0) - sentCount - failedCount),
          ...(sentTodayDelta > 0
            ? { sent_today: (campaign.sent_today || 0) + sentTodayDelta, last_sent_at: new Date().toISOString() }
            : {}),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", campaign.id);

      results.push({
        campaign_id: campaign.id,
        name: campaign.name,
        sent: sentCount,
        failed: failedCount,
      });
    }

    console.log("[recurring-processor] Done:", JSON.stringify(results));

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[recurring-processor] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ===== Email via AWS SES =====
async function sendEmail(
  contact: any,
  dayConfig: any,
  settings: any
): Promise<{ success: boolean; error?: string }> {
  console.log(`[recurring-processor] Email: aws_ses_enabled=${settings?.aws_ses_enabled}, has_key=${!!settings?.aws_access_key_id}, has_from=${!!settings?.aws_ses_email_from}, contact_email=${contact.email || '(vazio)'}`);
  if (!settings?.aws_ses_enabled) {
    return { success: false, error: "AWS SES desabilitado — ative em Configurações → Integrações → AWS SES" };
  }
  if (!settings?.aws_access_key_id || !settings?.aws_secret_access_key) {
    return { success: false, error: "Credenciais AWS SES não configuradas (Access Key / Secret Key)" };
  }
  if (!contact.email) {
    return { success: false, error: "Contato sem email cadastrado" };
  }

  const config = dayConfig.config || {};
  // subject_options: teste A/B simples (50/50 por contato) — se presente,
  // sorteia 1 dos assuntos a cada envio; senão usa o subject único de sempre.
  const rawSubject = Array.isArray(config.subject_options) && config.subject_options.length > 0
    ? config.subject_options[Math.floor(Math.random() * config.subject_options.length)]
    : (config.subject || "Campanha");
  const subject = rawSubject
    .replace(/\{\{nome\}\}/g, contact.name || contact.call_name || "Cliente")
    .replace(/\{\{empresa\}\}/g, contact.oficina || "");

  let body = (config.html_body || config.message || "")
    .replace(/\{\{nome\}\}/g, contact.name || contact.call_name || "Cliente")
    .replace(/\{\{empresa\}\}/g, contact.oficina || "");

  // If body doesn't contain HTML tags, wrap in basic HTML
  if (!body.includes("<")) {
    body = `<html><body><p>${body.replace(/\n/g, "<br>")}</p></body></html>`;
  }

  const region = settings.aws_region || "us-east-1";
  const accessKeyId = settings.aws_access_key_id;
  const secretAccessKey = settings.aws_secret_access_key;
  // from_email por dia/campanha sobrepõe o remetente global — só funciona
  // se o endereço (ou o domínio inteiro) já estiver verificado no SES,
  // senão a AWS recusa o envio.
  const fromEmail = config.from_email || settings.aws_ses_email_from;
  // from_name por dia/campanha (ex: "Marco - Prema") sobrepõe o nome de
  // exibição global.
  const fromName = config.from_name || settings.aws_ses_email_from_name || "PremaCar";

  if (!accessKeyId || !secretAccessKey || !fromEmail) {
    return { success: false, error: "Credenciais AWS SES incompletas" };
  }

  try {
    // Use AWS SES SendEmail API v2 via REST
    const host = `email.${region}.amazonaws.com`;
    const endpoint = `https://${host}/v2/email/outbound-emails`;

    const payload = {
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Html: { Data: body, Charset: "UTF-8" },
          },
        },
      },
      Destination: {
        ToAddresses: [contact.email],
      },
      FromEmailAddress: `${fromName} <${fromEmail}>`,
    };

    // Sign request with AWS Signature V4
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.substring(0, 8);

    const encoder = new TextEncoder();

    async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key instanceof Uint8Array ? key : new Uint8Array(key),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      return await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
    }

    async function sha256(data: string): Promise<string> {
      const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
    }

    const payloadStr = JSON.stringify(payload);
    const payloadHash = await sha256(payloadStr);

    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-date";
    const canonicalRequest = `POST\n/v2/email/outbound-emails\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

    const credentialScope = `${dateStamp}/${region}/ses/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

    const kDate = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp);
    const kRegion = await hmac(kDate, region);
    const kService = await hmac(kRegion, "ses");
    const kSigning = await hmac(kService, "aws4_request");
    const signatureBuffer = await hmac(kSigning, stringToSign);
    const signature = Array.from(new Uint8Array(signatureBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");

    const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Amz-Date": amzDate,
        Authorization: authorizationHeader,
      },
      body: payloadStr,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[recurring-processor] SES error:", errorText);
      return { success: false, error: `SES Error ${response.status}: ${errorText.substring(0, 200)}` };
    }

    console.log("[recurring-processor] Email sent to:", contact.email);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ===== WhatsApp via SendCredentials (Meta ou Evolution) =====
// Usa o mesmo resolveSendCredentials do campaign-processor (Disparos),
// garantindo que meta_api_enabled seja verificado antes de tentar a Meta API.
async function sendWhatsApp(
  contact: any,
  dayConfig: any,
  creds: SendCredentials,
  supabase: any
): Promise<{ success: boolean; error?: string }> {
  const config = dayConfig.config || {};
  const contactName = contact.name || contact.call_name || "Cliente";
  const message = (config.message || "")
    .replace(/\{\{nome\}\}/g, contactName)
    .replace(/\{\{empresa\}\}/g, contact.oficina || "");

  if (!contact.phone_number) {
    return { success: false, error: "Contato sem número de telefone" };
  }

  const cleanPhone = contact.phone_number.replace(/\D/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

  // Normaliza: a UI salva meta_template_id, versões antigas usavam template_id
  const templateId = config.meta_template_id || config.template_id || null;

  console.log(`[recurring-processor] sendWhatsApp: api_type=${creds.api_type}, phone=${formattedPhone}, templateId=${templateId || "none"}`);

  // ── Meta API ──────────────────────────────────────────────────────────────
  if (creds.api_type === "meta") {
    if (!creds.meta_access_token || !creds.meta_phone_number_id) {
      return { success: false, error: "Credenciais Meta incompletas (meta_access_token ou meta_phone_number_id ausente)" };
    }

    const url = `https://graph.facebook.com/v21.0/${creds.meta_phone_number_id}/messages`;
    let payload: any;

    if (templateId) {
      const { data: template } = await supabase
        .from("meta_templates")
        .select("name, language_code, parameters_count, parameters_mapping, status")
        .eq("id", templateId)
        .single();

      if (!template) {
        return { success: false, error: `Template ${templateId} não encontrado na tabela meta_templates. Verifique o cadastro em Configurações → Templates.` };
      }
      if (template.status !== "approved") {
        return { success: false, error: `Template "${template.name}" não aprovado pela Meta (status: ${template.status}). Aguarde aprovação ou escolha outro template.` };
      }

      console.log(`[recurring-processor] Meta template "${template.name}" (${template.language_code}) → ${formattedPhone}`);

      const components: any[] = [];
      if (template.parameters_count > 0) {
        // parameters_mapping é salvo como array [{index, field}], não um
        // objeto {"1": "field"} — mapping["1"] num array acessava o
        // elemento de ÍNDICE 1 (segundo item), não o item com index===1,
        // então templates com mais de 1 variável ou com a 1ª variável
        // mapeada pra algo diferente de "nome" mandavam o valor errado
        // (só "funcionava" em templates de 1 variável = nome, por
        // coincidência do fallback pro próprio nome do contato).
        const mapping = (template.parameters_mapping as Array<{ index: number; field: string }>) || [];
        const params: any[] = [];
        for (let i = 1; i <= template.parameters_count; i++) {
          const paramKey = mapping.find((m) => m.index === i)?.field || "";
          let value = contactName;
          if (paramKey === "empresa" || paramKey === "company") value = contact.oficina || "sua empresa";
          else if (paramKey === "telefone" || paramKey === "phone") value = contact.phone_number;
          params.push({ type: "text", text: value });
        }
        components.push({ type: "body", parameters: params });
      }

      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "template",
        template: {
          name: template.name,
          language: { code: template.language_code },
          ...(components.length > 0 ? { components } : {}),
        },
      };
    } else if (message) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "text",
        text: { body: message },
      };
    } else {
      return { success: false, error: "Nenhum template ou mensagem configurado para este dia da campanha" };
    }

    console.log(`[recurring-processor] Meta payload:`, JSON.stringify(payload).substring(0, 500));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${creds.meta_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (response.ok) {
      console.log(`[recurring-processor] Meta API success, message ID:`, data.messages?.[0]?.id);
      return { success: true };
    }

    const errMsg = data.error?.message || JSON.stringify(data.error) || "Meta API error";
    console.error(`[recurring-processor] Meta API erro (${response.status}): ${errMsg}`);
    return { success: false, error: `Meta API ${response.status}: ${errMsg}` };
  }

  // ── Evolution API ─────────────────────────────────────────────────────────
  if (creds.api_type === "evolution") {
    if (!creds.evolution_api_url || !creds.evolution_api_key || !creds.evolution_instance_name) {
      return { success: false, error: "Credenciais Evolution incompletas (URL, API key ou instância ausente)" };
    }
    if (!message) {
      return { success: false, error: "Evolution API requer mensagem de texto (configure uma mensagem no dia da campanha)" };
    }

    const evolutionUrl = `${creds.evolution_api_url.replace(/\/$/, "")}/message/sendText/${creds.evolution_instance_name}`;
    console.log(`[recurring-processor] Evolution API: ${evolutionUrl}, phone: ${formattedPhone}`);

    const response = await fetch(evolutionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: creds.evolution_api_key },
      body: JSON.stringify({ number: formattedPhone, text: message }),
    });

    const respData = await response.json().catch(() => ({}));
    console.log(`[recurring-processor] Evolution response ${response.status}:`, JSON.stringify(respData).substring(0, 400));

    if (!response.ok) {
      return { success: false, error: respData.message || respData.error || `Evolution API error ${response.status}` };
    }
    if (!respData?.key?.id && !respData?.messageId) {
      const errDetail = respData?.message || respData?.error || respData?.status || JSON.stringify(respData).substring(0, 150);
      console.error(`[recurring-processor] Evolution HTTP 200 sem key.id — erro silencioso:`, errDetail);
      return { success: false, error: `Evolution API: mensagem não enfileirada — ${errDetail}` };
    }

    console.log(`[recurring-processor] Evolution success, key.id:`, respData.key?.id || respData.messageId);
    return { success: true };
  }

  return { success: false, error: "api_type desconhecido nas credenciais WhatsApp" };
}

// ===== Ligação via make-voice-call =====
async function sendCall(
  contact: any,
  dayConfig: any,
  supabase: any,
  supabaseUrl: string
): Promise<{ success: boolean; error?: string }> {
  const config = dayConfig.config || {};
  const message = config.message || 'Olá {{nome}}, esta é uma mensagem da PremaCar.';
  console.log(`[recurring-processor] Call: contactId=${contact.id}, phone=${contact.phone_number}, supabaseUrl=${supabaseUrl}`);

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/make-voice-call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`
      },
      body: JSON.stringify({
        contactId: contact.id,
        message
      })
    });

    const result = await resp.json();

    if (!result.success) {
      return { success: false, error: result.error || 'Erro ao fazer ligação' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
