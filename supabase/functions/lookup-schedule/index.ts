import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { timezoneFromLatLng } from '../_shared/tz.ts'
import {
  isNYCAddress, geocodeNYC, lookupDSNYZone, generateDSNYEvents,
} from '../_shared/nyc-dsny.ts'
import {
  parseIcalUrl, getEventsForPlace, getEvents, normalizeEventType,
} from '../_shared/recollect.ts'

export function normalizeAddress(street: string, city: string, state: string): string {
  return [street, city, state].map(s => s.trim().toLowerCase()).join('|')
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })

  let body: { street?: string; city?: string; state?: string; ical_url?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { street, city, state, ical_url } = body

  // Validate: need either address fields or ical_url
  if (!ical_url && (!street || !city || !state)) {
    return json({ error: 'Provide either (street + city + state) or ical_url' }, 400)
  }

  // Rate limit
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { allowed, retryAfter } = await checkRateLimit(supabase, {
    key: `lookup:${ip}`, maxPerMinute: 10, maxPerDay: 100,
  })
  if (!allowed) {
    return json({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': String(retryAfter) })
  }

  const after = new Date().toISOString().slice(0, 10)
  const before = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // ── iCal URL path ──────────────────────────────────────────────────────────
  if (ical_url) {
    const parts = parseIcalUrl(ical_url)
    if (!parts) return json({ error: 'Invalid Recollect calendar URL' }, 400)

    const addressKey = `ical:${parts.placeId}:${parts.serviceId}`

    const { data: cached } = await supabase
      .from('place_lookup_cache')
      .select('*')
      .eq('address_key', addressKey)
      .single()

    if (cached) {
      const rawEvents = await getEventsForPlace(parts.placeId, parts.serviceId, after, before)
      return json({ place: cached, events: rawEvents })
    }

    let rawEvents: Awaited<ReturnType<typeof getEventsForPlace>>
    try {
      rawEvents = await getEventsForPlace(parts.placeId, parts.serviceId, after, before)
    } catch (err) {
      console.error('iCal fetch error', err)
      return json({ error: 'Could not fetch schedule from calendar URL' }, 502)
    }

    const supportedTypes = [...new Set(rawEvents.map(e => e.event_type))]
    const cacheRow = {
      address_key: addressKey,
      recollect_place_id: parts.placeId,
      latitude: null,
      longitude: null,
      timezone: null,
      supported_event_types: supportedTypes,
      provider: 'recollect-ical',
      provider_data: { place_id: parts.placeId, service_id: parts.serviceId, ical_url },
    }
    await supabase.from('place_lookup_cache').upsert(cacheRow)
    return json({ place: cacheRow, events: rawEvents })
  }

  // ── Address path ───────────────────────────────────────────────────────────
  const addressKey = normalizeAddress(street!, city!, state!)

  const { data: cached } = await supabase
    .from('place_lookup_cache')
    .select('*')
    .eq('address_key', addressKey)
    .single()

  if (cached) {
    const events = await eventsFromCache(cached, after, before)
    return json({ place: cached, events })
  }

  // ── NYC DSNY ───────────────────────────────────────────────────────────────
  if (isNYCAddress(city!, state!)) {
    const coords = await geocodeNYC(street!, city!, state!)
    if (!coords) return json({ error: 'Address not found', notFound: true }, 404)

    const zone = await lookupDSNYZone(coords.lat, coords.lng)
    if (!zone) return json({ error: 'Address not in NYC schedule zones', notFound: true }, 404)

    const timezone = timezoneFromLatLng(coords.lat, coords.lng)
    const supportedTypes = ['garbage', 'recycling']
    if (zone.freq_organics) supportedTypes.push('organics')

    const cacheRow = {
      address_key: addressKey,
      recollect_place_id: null,
      latitude: coords.lat,
      longitude: coords.lng,
      timezone,
      supported_event_types: supportedTypes,
      provider: 'nyc-dsny',
      provider_data: zone,
    }
    await supabase.from('place_lookup_cache').upsert(cacheRow)

    const events = generateDSNYEvents(zone, 60).map(e => ({
      date: e.event_date,
      event_type: e.event_type,
    }))
    return json({ place: cacheRow, events })
  }

  // ── Not covered ────────────────────────────────────────────────────────────
  return json({ error: 'Address not found', notFound: true }, 404)
}

async function eventsFromCache(
  cached: Record<string, unknown>,
  after: string,
  before: string
) {
  if (cached.provider === 'nyc-dsny') {
    const zone = cached.provider_data as Parameters<typeof generateDSNYEvents>[0]
    return generateDSNYEvents(zone, 60).map(e => ({
      date: e.event_date,
      event_type: e.event_type,
    }))
  }

  if (cached.provider === 'recollect-ical') {
    const pd = cached.provider_data as { place_id: string; service_id: string } | null
    if (pd?.place_id && pd?.service_id) {
      return getEventsForPlace(pd.place_id, pd.service_id, after, before)
    }
  }

  // Original recollect rows (provider = 'recollect' or null) store place ID in
  // recollect_place_id column, not in provider_data. Use authenticated getEvents.
  if (cached.provider === 'recollect' || !cached.provider) {
    const placeId = cached.recollect_place_id as string | null
    if (placeId) {
      return getEvents(placeId, after, before)
    }
  }

  return []
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

if (import.meta.main) Deno.serve(handler)
