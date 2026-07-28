// supabase/functions/_shared/jersey-city.ts

const JC_GARBAGE_URL =
  'https://data.jerseycitynj.gov/api/explore/v2.1/catalog/datasets/garbage-collection-map/records'
const JC_RECYCLING_URL =
  'https://data.jerseycitynj.gov/api/explore/v2.1/catalog/datasets/recycling-collection-map/records'

export interface JCEvent {
  date: string        // YYYY-MM-DD
  event_type: string
}

export interface JCResult {
  events: JCEvent[]
  garbage_days: string[]   // e.g. ['tuesday', 'friday']
  recycling_days: string[] // e.g. ['monday']
  lat: number
  lng: number
}

export function isJerseyCity(city: string): boolean {
  return city.trim().toLowerCase() === 'jersey city'
}

async function geocodeForJC(
  street: string,
  city: string,
  state: string,
): Promise<{ lat: number; lng: number } | null> {
  const q = encodeURIComponent(`${street}, ${city}, ${state}, USA`)
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
    { headers: { 'User-Agent': 'whenIsMy/1.0 (pickup schedule app)' } },
  )
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  if (!Array.isArray(data) || !data.length) return null
  const parsedLat = parseFloat(data[0].lat)
  const parsedLng = parseFloat(data[0].lon)
  if (!isFinite(parsedLat) || !isFinite(parsedLng)) return null
  return { lat: parsedLat, lng: parsedLng }
}

async function queryJCZoneName(apiUrl: string, lat: number, lng: number): Promise<string | null> {
  const point = `geom'POINT(${lng} ${lat})'`
  // Use point-in-polygon first; fall back to 50m buffer for points that land
  // on a polygon edge due to geocoder imprecision
  for (const where of [
    `intersects(geo_shape,${point})`,
    `within_distance(geo_shape,${encodeURIComponent(point)},50m)`,
  ]) {
    const res = await fetch(`${apiUrl}?where=${encodeURIComponent(where)}&limit=1&select=name`)
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const name = data?.results?.[0]?.name
    if (typeof name === 'string') return name
  }
  return null
}

const DOW_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

export function parseJCDays(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[\s/,]+/)
    .map(s => s.trim())
    .filter(s => s in DOW_INDEX)
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nextOccurrence(dow: number, from: Date): Date {
  const diff = (dow - from.getDay() + 7) % 7
  const d = new Date(from)
  d.setDate(d.getDate() + diff)
  return d
}

// Regenerates the recurring garbage/recycling schedule from the stored zone
// days (place_lookup_cache.provider_data) — no external API call needed.
export function eventsFromProviderData(
  pd: { garbage_days?: string[]; recycling_days?: string[] } | null,
  daysAhead: number,
): JCEvent[] {
  if (!pd) return []
  return [
    ...generateJCWeeklyEvents(pd.garbage_days ?? [], 'garbage', daysAhead),
    ...generateJCWeeklyEvents(pd.recycling_days ?? [], 'recycling', daysAhead),
  ].sort((a, b) => a.date.localeCompare(b.date))
}

export function generateJCWeeklyEvents(
  days: string[],
  eventType: string,
  daysAhead: number,
): JCEvent[] {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const endMs = start.getTime() + daysAhead * 86_400_000
  const events: JCEvent[] = []
  for (const day of days) {
    const dow = DOW_INDEX[day]
    if (dow === undefined) continue
    const d = nextOccurrence(dow, start)
    while (d.getTime() < endMs) {
      events.push({ date: localDateStr(d), event_type: eventType })
      d.setDate(d.getDate() + 7)
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date))
}

export async function getJerseyCityEvents(
  street: string,
  city: string,
  state: string,
  daysAhead = 90,
): Promise<JCResult | null> {
  const coords = await geocodeForJC(street, city, state)
  if (!coords) return null

  const [garbageName, recyclingName] = await Promise.all([
    queryJCZoneName(JC_GARBAGE_URL, coords.lat, coords.lng),
    queryJCZoneName(JC_RECYCLING_URL, coords.lat, coords.lng),
  ])

  if (!garbageName && !recyclingName) return null

  const garbageDays = garbageName ? parseJCDays(garbageName) : []
  const recyclingDays = recyclingName ? parseJCDays(recyclingName) : []

  const events: JCEvent[] = [
    ...generateJCWeeklyEvents(garbageDays, 'garbage', daysAhead),
    ...generateJCWeeklyEvents(recyclingDays, 'recycling', daysAhead),
  ].sort((a, b) => a.date.localeCompare(b.date))

  return { events, garbage_days: garbageDays, recycling_days: recyclingDays, lat: coords.lat, lng: coords.lng }
}
