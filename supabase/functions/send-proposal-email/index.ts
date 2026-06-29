import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, body, proposal_id } = await req.json()

    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios: to, subject, body' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Fetch AWS SES settings from integration_settings
    const { data: settings } = await supabase
      .from('integration_settings')
      .select('aws_ses_enabled, aws_access_key_id, aws_secret_access_key, aws_region, aws_ses_email_from, aws_ses_email_from_name')
      .single()

    if (!settings?.aws_ses_enabled) {
      return new Response(
        JSON.stringify({ success: false, error: 'AWS SES não está habilitado. Configure em Configurações > Integrações.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const { aws_access_key_id, aws_secret_access_key, aws_region, aws_ses_email_from, aws_ses_email_from_name } = settings
    if (!aws_access_key_id || !aws_secret_access_key || !aws_ses_email_from) {
      return new Response(
        JSON.stringify({ success: false, error: 'Credenciais AWS SES incompletas' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      )
    }

    const region = aws_region || 'us-east-1'
    const fromName = aws_ses_email_from_name || 'Prema Car'
    const result = await sendViaSES({ to, subject, htmlBody: body, region, accessKeyId: aws_access_key_id, secretAccessKey: aws_secret_access_key, fromEmail: aws_ses_email_from, fromName })

    if (result.success && proposal_id) {
      await supabase
        .from('propostas_comerciais')
        .update({ status: 'enviada', enviada_at: new Date().toISOString() })
        .eq('id', proposal_id)
        .eq('status', 'rascunho')
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 },
    )
  }
})

async function sendViaSES({ to, subject, htmlBody, region, accessKeyId, secretAccessKey, fromEmail, fromName }: {
  to: string; subject: string; htmlBody: string
  region: string; accessKeyId: string; secretAccessKey: string; fromEmail: string; fromName: string
}): Promise<{ success: boolean; error?: string }> {
  const encoder = new TextEncoder()

  async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', key instanceof Uint8Array ? key : new Uint8Array(key),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data))
  }

  async function sha256(data: string): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const host = `email.${region}.amazonaws.com`
  const endpoint = `https://${host}/v2/email/outbound-emails`

  const payload = {
    Content: {
      Simple: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Html: { Data: htmlBody, Charset: 'UTF-8' } },
      },
    },
    Destination: { ToAddresses: [to] },
    FromEmailAddress: `${fromName} <${fromEmail}>`,
  }

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.substring(0, 8)
  const payloadStr = JSON.stringify(payload)
  const payloadHash = await sha256(payloadStr)

  const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`
  const signedHeaders = 'content-type;host;x-amz-date'
  const canonicalRequest = `POST\n/v2/email/outbound-emails\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`
  const credentialScope = `${dateStamp}/${region}/ses/aws4_request`
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`

  const kDate = await hmac(encoder.encode(`AWS4${secretAccessKey}`), dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, 'ses')
  const kSigning = await hmac(kService, 'aws4_request')
  const sigBuf = await hmac(kSigning, stringToSign)
  const signature = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('')

  const authorizationHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Amz-Date': amzDate, Authorization: authorizationHeader },
      body: payloadStr,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `SES Error ${response.status}: ${errorText.substring(0, 200)}` }
    }

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}
