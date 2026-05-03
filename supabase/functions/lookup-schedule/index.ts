import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { timezoneFromLatLng } from '../_shared/tz.ts'
import {
  isNYCAddress, geocodeNYC, lookupDSNYZone, generateDSNYEvents,
} from '../_shared/nyc-dsny.ts'
import {
  parseIcalUrl, getEventsForPlace, getEvents, normalizeEventType,
} from '../_shared/recollect.ts'
import {
  getRecycleCoachResult,
  getEventsFromRCZone,
  type RCCity,
} from '../_shared/recyclecoach.ts'
import {
  isJerseyCity,
  getJerseyCityEvents,
  generateJCWeeklyEvents,
} from '../_shared/jersey-city.ts'

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

  // ── New Jersey ────────────────────────────────────────────────────────────
  if (state!.trim().toUpperCase() === 'NJ') {
    // Hoboken: citywide fixed schedule, same for every address — no API needed
    if (city!.trim().toLowerCase() === 'hoboken') {
      const hobokenEvents = generateHobokenEvents(60)
      const cacheRow = {
        address_key: addressKey,
        recollect_place_id: null,
        latitude: null,
        longitude: null,
        timezone: 'America/New_York',
        supported_event_types: ['garbage', 'recycling', 'bulk_waste', 'yard_waste'],
        provider: 'hoboken-static',
        provider_data: null,
      }
      await supabase.from('place_lookup_cache').upsert(cacheRow)
      return json({ place: cacheRow, events: hobokenEvents })
    }

    // Jersey City has its own open data GeoJSON zone API; RecycleCoach zone-setup
    // returns empty results for JC addresses, so it must be handled separately.
    if (isJerseyCity(city!)) {
      const jcResult = await getJerseyCityEvents(street!, city!, state!)
      if (!jcResult) return json({ error: 'Address not found', notFound: true }, 404)

      const supportedTypes: string[] = []
      if (jcResult.garbage_days.length) supportedTypes.push('garbage')
      if (jcResult.recycling_days.length) supportedTypes.push('recycling')

      const cacheRow = {
        address_key: addressKey,
        recollect_place_id: null,
        latitude: jcResult.lat,
        longitude: jcResult.lng,
        timezone: 'America/New_York',
        supported_event_types: supportedTypes,
        provider: 'jersey-city',
        provider_data: { garbage_days: jcResult.garbage_days, recycling_days: jcResult.recycling_days },
      }
      await supabase.from('place_lookup_cache').upsert(cacheRow)
      return json({ place: cacheRow, events: jcResult.events })
    }

    // All other NJ cities: RecycleCoach (NJDEP-funded, covers all 21 counties)
    const rcResult = await getRecycleCoachResult(street!, city!, state!)
    if (rcResult) {
      const supportedTypes = [...new Set(rcResult.events.map(e => e.event_type))]
      const cacheRow = {
        address_key: addressKey,
        recollect_place_id: null,
        latitude: null,
        longitude: null,
        timezone: 'America/New_York',
        supported_event_types: supportedTypes,
        provider: 'recyclecoach',
        provider_data: {
          project_id: rcResult.city.project_id,
          district_id: rcResult.city.district_id,
          zone_id: rcResult.zone_id,
          apigw_prefix: rcResult.city.apigw_prefix,
        },
      }
      await supabase.from('place_lookup_cache').upsert(cacheRow)
      return json({ place: cacheRow, events: rcResult.events })
    }

    // RecycleCoach returned nothing — distinguish notFound from notCovered
    const njExists = await addressExistsNominatim(street!, city!, state!)
    if (!njExists) return json({ error: 'Address not found', notFound: true }, 404)
    return json({ error: 'Address not covered', notCovered: true }, 404)
  }

  // ── Not covered ────────────────────────────────────────────────────────────
  // Geocode with Nominatim to distinguish "fake address" from "real but not covered"
  const exists = await addressExistsNominatim(street!, city!, state!)
  if (!exists) return json({ error: 'Address not found', notFound: true }, 404)
  return json({ error: 'Address not covered', notCovered: true }, 404)
}

async function addressExistsNominatim(street: string, city: string, state: string): Promise<boolean> {
  try {
    const q = encodeURIComponent(`${street}, ${city}, ${state}, USA`)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&addressdetails=1`,
      { headers: { 'User-Agent': 'whenIsMy/1.0 (pickup schedule app)' } }
    )
    if (!res.ok) return true // fail open so real addresses aren't incorrectly blocked
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return false
    return !!data[0]?.address?.house_number
  } catch {
    return true // fail open on network error
  }
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

  if (cached.provider === 'hoboken-static') {
    return generateHobokenEvents(60)
  }

  if (cached.provider === 'recyclecoach') {
    const pd = cached.provider_data as {
      project_id: string
      district_id: string
      zone_id: string
      apigw_prefix: string
    } | null
    if (pd) {
      const rcCity: RCCity = {
        project_id: pd.project_id,
        district_id: pd.district_id,
        apigw_prefix: pd.apigw_prefix ?? 'us',
      }
      return getEventsFromRCZone(rcCity, pd.zone_id, 60)
    }
  }

  if (cached.provider === 'jersey-city') {
    const pd = cached.provider_data as {
      garbage_days: string[]
      recycling_days: string[]
    } | null
    if (pd) {
      return [
        ...generateJCWeeklyEvents(pd.garbage_days ?? [], 'garbage', 60),
        ...generateJCWeeklyEvents(pd.recycling_days ?? [], 'recycling', 60),
      ].sort((a, b) => a.date.localeCompare(b.date))
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

// Hoboken has a single citywide schedule — same for every address, no zones.
// Source: https://www.hobokennj.gov/resources/waste-collection
function generateHobokenEvents(daysAhead: number): { date: string; event_type: string }[] {
  const DOW: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  }
  function pad(n: number) { return String(n).padStart(2, '0') }
  function localStr(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  function nextDow(dow: number, from: Date): Date {
    const diff = (dow - from.getDay() + 7) % 7
    const d = new Date(from)
    d.setDate(d.getDate() + diff)
    return d
  }

  const SCHEDULE: { dow: string; event_type: string }[] = [
    { dow: 'monday',    event_type: 'garbage' },
    { dow: 'tuesday',   event_type: 'recycling' },   // commingled (plastics, glass, cans)
    { dow: 'thursday',  event_type: 'garbage' },
    { dow: 'friday',    event_type: 'recycling' },   // paper + cardboard
    { dow: 'friday',    event_type: 'bulk_waste' },  // metal furniture, appliances, e-waste
    { dow: 'friday',    event_type: 'yard_waste' },  // seasonal yard/garden waste
    { dow: 'saturday',  event_type: 'garbage' },
  ]

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const endMs = start.getTime() + daysAhead * 86_400_000
  const events: { date: string; event_type: string }[] = []

  for (const { dow, event_type } of SCHEDULE) {
    const d = nextDow(DOW[dow], start)
    while (d.getTime() < endMs) {
      events.push({ date: localStr(d), event_type })
      d.setDate(d.getDate() + 7)
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date))
}

if (import.meta.main) Deno.serve(handler)
