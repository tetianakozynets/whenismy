import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'

const SUPPORT_EMAIL = Deno.env.get('SUPPORT_EMAIL') ?? 'support@whenismy.app'

function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), {
      status: 500,
      headers: corsHeaders(),
    })
  }

  const supabase = createClient(url, key)

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { allowed } = await checkRateLimit(supabase, {
    key: `coverage:${ip}`,
    maxPerMinute: 2,
    maxPerDay: 5,
  })
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
      status: 429,
      headers: corsHeaders(),
    })
  }

  let body: { city?: string; state?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: corsHeaders(),
    })
  }

  const { city, state } = body
  if (!city || !state) {
    return new Response(JSON.stringify({ error: 'city and state required' }), {
      status: 400,
      headers: corsHeaders(),
    })
  }

  // Send via Supabase Auth admin email
  // Note: requires Supabase Pro plan SMTP config or replace with Resend/SendGrid
  const { error } = await supabase.auth.admin.sendRawEmail({
    to: SUPPORT_EMAIL,
    subject: `Coverage request: ${city}, ${state}`,
    html: `<p>A user requested Recollect coverage for <strong>${city}, ${state}</strong>.</p>`,
  })

  if (error) {
    console.error('Email send failed', error)
    return new Response(JSON.stringify({ error: 'Failed to send request' }), {
      status: 502,
      headers: corsHeaders(),
    })
  }

  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders() })
}

if (import.meta.main) {
  Deno.serve(handler)
}
