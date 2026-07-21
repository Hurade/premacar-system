import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  try {
    const { connection_id } = await req.json()

    if (!connection_id) {
      return new Response(JSON.stringify({ success: false, error: 'connection_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: conn, error: connErr } = await supabase
      .from('whatsapp_connections')
      .select('id, name, api_type, evolution_base_url, evolution_api_key, evolution_instance_name, is_connected')
      .eq('id', connection_id)
      .eq('api_type', 'evolution')
      .maybeSingle()

    if (connErr || !conn) {
      return new Response(JSON.stringify({ success: false, error: 'Conexão Evolution não encontrada' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!conn.evolution_base_url || !conn.evolution_api_key || !conn.evolution_instance_name) {
      return new Response(JSON.stringify({ success: false, error: 'Credenciais Evolution incompletas' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const baseUrl = conn.evolution_base_url.replace(/\/$/, '')
    const instance = conn.evolution_instance_name

    // Endpoint /instance/connect/{instance} retorna QR code base64
    const qrRes = await fetch(`${baseUrl}/instance/connect/${instance}`, {
      method: 'GET',
      headers: { 'apikey': conn.evolution_api_key },
    })

    if (!qrRes.ok) {
      const body = await qrRes.text()
      console.error(`[get-qr-code] Evolution ${qrRes.status}:`, body)
      return new Response(JSON.stringify({
        success: false,
        error: `Evolution API retornou ${qrRes.status}`,
        details: body,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const qrData = await qrRes.json()

    // Evolution API v2: { base64: "data:image/png;base64,...", code: "..." }
    // Evolution API v1: { qrcode: { base64: "...", code: "..." } }
    const base64 = qrData?.base64 || qrData?.qrcode?.base64 || qrData?.qr_code || null
    const isConnected = qrData?.state === 'open' || qrData?.connectionStatus === 'open'

    if (isConnected) {
      // Instância já conectada — atualiza flag e retorna
      await supabase
        .from('whatsapp_connections')
        .update({ is_connected: true, last_connected_at: new Date().toISOString() })
        .eq('id', connection_id)

      return new Response(JSON.stringify({ success: true, already_connected: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!base64) {
      return new Response(JSON.stringify({
        success: false,
        error: 'QR code não disponível. Verifique se a instância existe na Evolution API.',
        raw: qrData,
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Salva QR code no banco (expira em 60s — Twilio renova a cada 30s mas guardamos 60s de folga)
    const expiresAt = new Date(Date.now() + 60_000).toISOString()
    await supabase
      .from('whatsapp_connections')
      .update({ qr_code: base64, qr_code_expires_at: expiresAt })
      .eq('id', connection_id)

    return new Response(JSON.stringify({ success: true, base64, expires_at: expiresAt }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    console.error('[get-qr-code] Error:', err)
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
