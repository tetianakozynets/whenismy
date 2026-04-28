import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { searchPlaces, getEvents, normalizeEventType } from '../_shared/recollect.ts'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { timezoneFromLatLng } from '../_shared/tz.ts'

export function normalizeAddress(street: string, city: string, state: string): string {
  return [street, city, state].map(s => s.trim().toLowerCase()).join('|')
}

export async function handler(req: Request): Promise<Response> {
  // 1. CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() })
  }

  // 2. Parse JSON body
  let body: { street?: string; city?: string; state?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  // 3. Validate required fields — runs before any Supabase/rate-limit I/O
  const { street, city, state } = body
  if (!street || !city || !state) {
    return json({ error: 'street, city, and state are required' }, 400)
  }

  // 4. Rate limit check
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { allowed, retryAfter } = await checkRateLimit(supabase, {
    key: `lookup:${ip}`,
    maxPerMinute: 10,
    maxPerDay: 100,
  })
  if (!allowed) {
    return json({ error: 'Rate limit exceeded' }, 429, {
      'Retry-After': String(retryAfter),
    })
  }

  const addressKey = normalizeAddress(street, city, state)

  // 5. Cache lookup
  const { data: cached } = await supabase
    .from('place_lookup_cache')
    .select('*')
    .eq('address_key', addressKey)
    .single()

  if (cached) {
    const events = await fetchEvents(cached.recollect_place_id)
    return json({ place: cached, events })
  }

  // 6. Recollect API call
  let places: Awaited<ReturnType<typeof searchPlaces>>
  try {
    places = await searchPlaces(street, city, state)
  } catch (err) {
    console.error('Recollect search error', err)
    return json({ error: 'Schedule data unavailable' }, 502)
  }

  if (places.length === 0) {
    return json({ error: 'Address not found', notFound: true }, 404)
  }

  const place = places[0]
  const timezone = timezoneFromLatLng(place.lat, place.lng)

  const events = await fetchEvents(place.id)
  const supportedTypes = [...new Set(events.map(e => normalizeEventType(e.event_type)))]

  const cacheRow = {
    address_key: addressKey,
    recollect_place_id: place.id,
    latitude: place.lat,
    longitude: place.lng,
    timezone,
    supported_event_types: supportedTypes,
  }

  await supabase.from('place_lookup_cache').upsert(cacheRow)

  return json({ place: cacheRow, events, multiple: places.length > 1 ? places : undefined })
}

async function fetchEvents(placeId: string) {
  const after = new Date().toISOString().slice(0, 10)
  const before = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const raw = await getEvents(placeId, after, before)
  return raw.map(e => ({ ...e, event_type: normalizeEventType(e.event_type) }))
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extra },
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

if (import.meta.main) {
  Deno.serve(handler)
}
