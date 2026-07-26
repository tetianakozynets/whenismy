const BASE = 'https://api.recollect.net/api'
const API_KEY = Deno.env.get('RECOLLECT_API_KEY')!

export interface RecollectPlace {
  id: string
  name: string
  locality: string
  lat: number
  lng: number
  services: RecollectService[]
}

export interface RecollectService {
  id: string
  name: string
}

export interface RecollectEvent {
  date: string        // 'YYYY-MM-DD'
  event_type: string  // 'garbage', 'recycling', 'yard_waste', etc.
}

function headers() {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
  }
}

export async function searchPlaces(
  street: string, city: string, state: string
): Promise<RecollectPlace[]> {
  const q = encodeURIComponent(`${street}, ${city}, ${state}`)
  const res = await fetch(`${BASE}/areas?q=${q}&locale=en-US`, { headers: headers() })
  if (!res.ok) throw new Error(`Recollect search failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.areas ?? [])
}

export async function getEvents(
  placeId: string,
  after: string,   // 'YYYY-MM-DD'
  before: string   // 'YYYY-MM-DD'
): Promise<RecollectEvent[]> {
  const res = await fetch(
    `${BASE}/places/${placeId}/events?after=${after}&before=${before}`,
    { headers: headers() }
  )
  if (!res.ok) throw new Error(`Recollect events failed: ${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.events ?? [])
}

export function normalizeEventType(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower.includes('recycl')) return 'recycling'
  if (lower.includes('yard') || lower.includes('green')) return 'yard_waste'
  return 'garbage'
}

// ── iCal URL parsing (no API key required) ───────────────────────────────────

export interface IcalUrlParts {
  placeId: string
  serviceId: string
}

export function parseIcalUrl(url: string): IcalUrlParts | null {
  const match = url.match(
    /\/places\/([0-9A-F-]{36})\/services\/(\d+)\//i
  )
  if (!match) return null
  return { placeId: match[1].toUpperCase(), serviceId: match[2] }
}

export async function getEventsForPlace(
  placeId: string,
  serviceId: string,
  after: string,
  before: string
): Promise<RecollectEvent[]> {
  const url = `https://api.recollect.net/api/places/${placeId}/services/${serviceId}/events` +
    `?after=${after}&before=${before}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Recollect place events failed: ${res.status}`)
  const data = await res.json()
  const rawEvents = Array.isArray(data) ? data : (data.events ?? [])

  const result: RecollectEvent[] = []
  for (const ev of rawEvents) {
    for (const flag of (ev.flags ?? [])) {
      if (flag.event_type === 'pickup' || flag.event_type === 'collection') {
        result.push({
          date: ev.day,
          event_type: normalizeEventType(flag.name ?? ''),
        })
      }
    }
  }
  return result
}
