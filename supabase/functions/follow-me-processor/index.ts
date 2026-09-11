import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendInternalNotification } from "../_shared/internal-notify.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TAG = '[FollowMe]';

// "Siga-me": conversa já em modo humano, com atendente atribuído, cuja
// última mensagem é do cliente (ninguém respondeu ainda) e já passou do
// prazo configurado (padrão 5min) — avisa o atendente por WhatsApp com um
// resumo de quem é o contato e o que ele precisa. Roda via pg_cron
// periodicamente (ver instruções no final da migration/README do commit).
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: candidates, error: candErr } = await supabase
      .from('conversations')
      .select('id, connection_id, contact_id, assigned_user_id, follow_me_notified_message_id')
      .eq('status', 'human')
      .eq('is_active', true)
      .not('assigned_user_id', 'is', null);

    if (candErr) throw candErr;

    let notified = 0;
    let checked = 0;

    for (const conv of candidates || []) {
      checked++;
      try {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('id, from_type, type, content, sent_at')
          .eq('conversation_id', conv.id)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Ninguém pendente de resposta: última mensagem não é do cliente
        if (!lastMsg || lastMsg.from_type !== 'user') continue;

        // Já avisamos sobre essa mesma mensagem antes — não repete
        if (conv.follow_me_notified_message_id === lastMsg.id) continue;

        const { data: teamMember } = await supabase
          .from('team_members')
          .select('id, name, notification_phone, follow_me_enabled, follow_me_delay_minutes')
          .eq('id', conv.assigned_user_id)
          .maybeSingle();

        if (!teamMember || !teamMember.follow_me_enabled || !teamMember.notification_phone) continue;

        const delayMs = (teamMember.follow_me_delay_minutes ?? 5) * 60 * 1000;
        const waitedMs = Date.now() - new Date(lastMsg.sent_at).getTime();
        if (waitedMs < delayMs) continue;

        const { data: contact } = await supabase
          .from('contacts')
          .select('name, call_name, phone_number, company')
          .eq('id', conv.contact_id)
          .maybeSingle();

        const displayName = contact?.call_name || contact?.name || 'Contato';
        const typeLabel = lastMsg.type === 'audio' ? '🎤 Mensagem de áudio'
          : lastMsg.type === 'image' ? '🖼️ Imagem'
          : lastMsg.type === 'document' ? '📄 Documento'
          : null;
        const contentPreview = lastMsg.content?.trim()
          ? lastMsg.content.trim()
          : (typeLabel || '(sem conteúdo)');
        const waitedMin = Math.max(1, Math.round(waitedMs / 60000));

        const notifMessage = `👋 *Siga-me*\n\n` +
          `👤 *Cliente:* ${displayName}${contact?.company ? ` (${contact.company})` : ''}\n` +
          `📱 *Telefone:* ${contact?.phone_number || 'não informado'}\n\n` +
          `💬 *Sem resposta há ${waitedMin} min:*\n${contentPreview}\n\n` +
          `_Responda assim que possível — esse aviso não se repete pra essa mesma mensagem._`;

        const sent = await sendInternalNotification(
          supabase,
          conv.connection_id ?? null,
          teamMember.notification_phone,
          notifMessage
        );

        if (sent) {
          await supabase
            .from('conversations')
            .update({ follow_me_notified_message_id: lastMsg.id })
            .eq('id', conv.id);
          notified++;
          console.log(`${TAG} Avisado ${teamMember.name} sobre conversa ${conv.id}`);
        } else {
          console.error(`${TAG} Falha ao enviar aviso pra ${teamMember.name} (conversa ${conv.id})`);
        }
      } catch (convErr) {
        console.error(`${TAG} Erro processando conversa ${conv.id}:`, convErr instanceof Error ? convErr.message : convErr);
      }
    }

    return new Response(JSON.stringify({ success: true, checked, notified }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error(`${TAG} Erro fatal:`, err);
    return new Response(JSON.stringify({ success: false, error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
