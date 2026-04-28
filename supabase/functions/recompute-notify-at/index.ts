import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

async function handler(_req: Request): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), { status: 500 })
  }

  const supabase = createClient(url, key)
  const { error, count } = await supabase.rpc('recompute_all_notify_at')

  if (error) {
    console.error('recompute_notify_at failed', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ updated: count }), { status: 200 })
}

if (import.meta.main) {
  Deno.serve(handler)
}
