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

interface NinaSettings {
  evolution_api_url: string | null;
  evolution_api_key: string | null;
  evolution_instance_name: string | null;
  timezone: string;
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

    // Get nina settings for Evolution API config
    const { data: settings } = await supabase
      .from("nina_settings")
      .select("evolution_api_url, evolution_api_key, evolution_instance_name, timezone")
      .limit(1)
      .single();

    if (!settings?.evolution_api_url || !settings?.evolution_api_key || !settings?.evolution_instance_name) {
      console.log("[campaign-processor] Evolution API not configured, skipping.");
      return new Response(
        JSON.stringify({ success: false, message: "Evolution API not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ninaSettings = settings as NinaSettings;
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentDay = now.getDay();

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

    for (const campaign of campaigns || []) {
      const campaignData = campaign as Campaign;
      console.log(`[campaign-processor] Processing campaign: ${campaignData.name}`);

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

      // Get message template
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
      let message = variations[variationIndex];

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

      try {
        // Send via Evolution API
        const evolutionUrl = `${ninaSettings.evolution_api_url}/message/sendText/${ninaSettings.evolution_instance_name}`;
        
        const response = await fetch(evolutionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": ninaSettings.evolution_api_key!,
          },
          body: JSON.stringify({
            number: lead.phone,
            text: message,
          }),
        });

        const responseData = await response.json();

        if (!response.ok) {
          throw new Error(responseData.message || "Evolution API error");
        }

        // Update lead status
        await supabase
          .from("campaign_leads")
          .update({
            status: "sent",
            variation_used: variationIndex,
            sent_at: new Date().toISOString(),
            whatsapp_message_id: responseData.key?.id || null,
          })
          .eq("id", lead.id);

        // Update campaign counters
        const newSentToday = campaignData.sent_today + 1;
        const newTotalSent = campaignData.total_sent + 1;

        let updateData: Record<string, any> = {
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

      } catch (sendError: any) {
        console.error(`[campaign-processor] Error sending message: ${sendError.message}`);

        // Update lead with error
        const attempts = (lead as any).attempts || 0;
        await supabase
          .from("campaign_leads")
          .update({
            status: attempts >= 2 ? "error" : "pending",
            error_message: sendError.message,
            attempts: attempts + 1,
          })
          .eq("id", lead.id);

        // Update campaign error count
        await supabase
          .from("campaigns")
          .update({ total_errors: campaignData.total_sent + 1 })
          .eq("id", campaignData.id);

        results.push({ campaignId: campaignData.id, sent: false, reason: sendError.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[campaign-processor] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
