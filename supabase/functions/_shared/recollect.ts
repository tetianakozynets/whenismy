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
