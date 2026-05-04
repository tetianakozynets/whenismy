// supabase/functions/_shared/recyclecoach.ts

export interface RCCity {
  project_id: string   // API calls this "sku"
  district_id: string
  apigw_prefix: string
}

export interface RCEvent {
  date: string        // YYYY-MM-DD
  event_type: string  // 'garbage' | 'recycling' | 'yard_waste' | 'bulk_waste' | 'organics'
}

export interface RCResult {
  events: RCEvent[]
  city: RCCity
  zone_ids: string[]
}

const RC_SEARCH_BASE = 'https://api-city.recyclecoach.com'

function apiBase(prefix: string): string {
  return `https://${prefix}-api-city.recyclecoach.com`
}

export async function searchRCCity(city: string, state: string): Promise<RCCity | null> {
  const term = encodeURIComponent(`${city}, ${state}, US`)
  const res = await fetch(`${RC_SEARCH_BASE}/city/search?term=${term}`)
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  const results: unknown[] = Array.isArray(data) ? data : (data?.results ?? [])
  if (!results.length) return null
  const hit = results[0] as Record<string, unknown>
  // API returns project_id field; zone-setup uses it as the "sku" query param
  const projectId = hit?.sku ?? hit?.project_id
  if (!projectId) return null
  const rawPrefix = String(hit.apigw_prefix ?? 'us')
  return {
    project_id: String(projectId),
    district_id: String(hit.district_id ?? ''),
    apigw_prefix: /^[a-z0-9-]{1,16}$/.test(rawPrefix) ? rawPrefix : 'us',
  }
}

export async function lookupRCZone(rcCity: RCCity, street: string): Promise<string[] | null> {
  const base = apiBase(rcCity.apigw_prefix)
  const params = new URLSearchParams({
    sku: rcCity.project_id,
    district: rcCity.district_id,
    prompt: 'undefined',
    term: street,
  })
  const res = await fetch(`${base}/zone-setup/address?${params}`)
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  const results: unknown[] = Array.isArray(data) ? data : (data?.results ?? [])
  if (!results.length) return null
  const zones = (results[0] as Record<string, unknown>).zones as Record<string, string> | undefined
  if (!zones || !Object.keys(zones).length) return null
  // Deduplicate zone values — each unique zone gets its own API call downstream
  return [...new Set(Object.values(zones))].sort().map(v => `zone-${v}`)
}

export function normalizeRCType(name: string): string | null {
  const n = name.toLowerCase()
  // Cancellations, closures, and non-pickup notifications must be excluded first
  // e.g. "Saturday Recycling Cancelled", "Recycle Yard Closure", "HHW - Mahwah", "Shred-It Event"
  if (n.includes('cancel') || n.includes('closure') || n.includes('hhw') || n.includes('shred')) return null
  // Community drop-off / special events are not curbside pickups
  if (n.includes('drop-off') || n.includes('drop off') || n.includes('recycling event') || n.includes('recycle event')) return null
  if (n.includes('garbage') || n.includes('trash') || n.includes('refuse') || n.includes('rubbish')) return 'garbage'
  if (n.includes('recycl') || n.includes('container') || n.includes('paper') || n.includes('glass') || n.includes('metal')) return 'recycling'
  if (n.includes('yard') || n.includes('leaf') || n.includes('brush') || n.includes('vegetation') || n.includes('grass')) return 'yard_waste'
  if (n.includes('bulk') || n.includes('large item') || n.includes('heavy')) return 'bulk_waste'
  if (n.includes('organic') || n.includes('compost') || n.includes('food')) return 'organics'
  return null
}

export async function buildRCTypeMap(rcCity: RCCity, zoneId: string): Promise<Map<string, string>> {
  const base = apiBase(rcCity.apigw_prefix)
  const params = new URLSearchParams({
    project_id: rcCity.project_id,
    district_id: rcCity.district_id,
    zone_id: zoneId,
    lang_cd: 'en_US',
  })
  const res = await fetch(`${base}/collections?${params}`)
  const map = new Map<string, string>()
  if (!res.ok) return map
  const data = await res.json().catch(() => null)
  // Actual format: { collection: { types: { "collection-2665": { title: "Garbage" } } } }
  const types = data?.collection?.types as Record<string, Record<string, unknown>> | undefined
  if (!types) return map
  for (const [key, val] of Object.entries(types)) {
    const id = key.startsWith('collection-') ? key.slice('collection-'.length) : null
    if (!id) continue
    const et = normalizeRCType(String(val?.title ?? ''))
    if (et) map.set(id, et)
  }
  return map
}

export async function fetchRCMonth(
  rcCity: RCCity,
  zoneId: string,
  typeMap: Map<string, string>,
  year: number,
  month: number, // 1-based
): Promise<RCEvent[]> {
  const base = apiBase(rcCity.apigw_prefix)
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const params = new URLSearchParams({
    project_id: rcCity.project_id,
    district_id: rcCity.district_id,
    zone_id: zoneId,
    lang_cd: 'en_US',
    month: monthStr,
  })
  const res = await fetch(`${base}/app_data_zone_schedules?${params}`)
  if (!res.ok) return []
  const data = await res.json().catch(() => null)
  if (!data) return []
  // Actual format: { DATA: [{ year, months: [{ month, events: [{ date, collections: [{ id, status }] }] }] }] }
  type RCScheduleCol = { id: number; status: string }
  type RCScheduleEvent = { date: string; day: number; collections: RCScheduleCol[] }
  type RCScheduleMonth = { month: number; events: RCScheduleEvent[] }
  type RCScheduleYear = { year: number; months: RCScheduleMonth[] }
  const dataArr = data?.DATA as RCScheduleYear[] | undefined
  if (!dataArr) return []

  const events: RCEvent[] = []
  for (const yearEntry of dataArr) {
    if (yearEntry.year !== year) continue
    for (const monthEntry of yearEntry.months) {
      if (monthEntry.month !== month) continue
      for (const event of monthEntry.events) {
        if (!event.date) continue
        for (const col of event.collections) {
          const s = (col.status ?? '').toLowerCase()
          if (s.includes('cancel') || s === 'suspended') continue
          const eventType = typeMap.get(String(col.id))
          if (eventType) events.push({ date: event.date, event_type: eventType })
        }
      }
    }
  }
  return events
}

export async function getEventsFromRCZone(
  rcCity: RCCity,
  zoneIds: string | string[],
  daysAhead = 60,
): Promise<RCEvent[]> {
  const ids = Array.isArray(zoneIds) ? zoneIds : [zoneIds]
  const now = new Date()
  const endDate = new Date(now.getTime() + daysAhead * 86_400_000)
  const allEvents: RCEvent[] = []

  for (const zoneId of ids) {
    const typeMap = await buildRCTypeMap(rcCity, zoneId)
    if (!typeMap.size) continue
    let cursor = new Date(now.getFullYear(), now.getMonth(), 1)
    while (cursor <= endDate) {
      const monthEvents = await fetchRCMonth(rcCity, zoneId, typeMap, cursor.getFullYear(), cursor.getMonth() + 1)
      allEvents.push(...monthEvents)
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    }
  }

  function localStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const todayStr = localStr(now)
  const endStr = localStr(endDate)
  const seen = new Set<string>()
  return allEvents
    .filter(e => e.date >= todayStr && e.date <= endStr)
    .filter(e => {
      const key = `${e.date}|${e.event_type}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function getRecycleCoachResult(
  street: string,
  city: string,
  state: string,
  daysAhead = 60,
): Promise<RCResult | null> {
  const rcCity = await searchRCCity(city, state)
  if (!rcCity) return null
  const zoneIds = await lookupRCZone(rcCity, street)
  if (!zoneIds) return null
  const events = await getEventsFromRCZone(rcCity, zoneIds, daysAhead)
  return { events, city: rcCity, zone_ids: zoneIds }
}
