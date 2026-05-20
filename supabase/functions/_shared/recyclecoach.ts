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

const RC_API_BASE = 'https://api-city.recyclecoach.com'
const RC_US_APIGW  = 'https://us-web.apigw.recyclecoach.com'

// Fetch with a 5-second timeout. Returns null on any network error so callers
// can treat unreachable RecycleCoach as "not found" rather than crashing.
async function rcFetch(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return res
  } catch {
    return null
  }
}

export async function searchRCCity(city: string, state: string): Promise<RCCity | null> {
  const term = encodeURIComponent(`${city}, ${state}, US`)
  const res = await rcFetch(`${RC_API_BASE}/city/search?term=${term}`)
  if (!res || !res.ok) return null
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
  const params = new URLSearchParams({
    sku: rcCity.project_id,
    district: rcCity.district_id,
    prompt: 'undefined',
    term: street,
  })
  // US cities: use apigw /single endpoint (api-city redirects to dead us-api-city for zone-setup)
  // CA and other cities: use api-city which redirects to the working regional server
  const url = rcCity.apigw_prefix === 'us'
    ? `${RC_US_APIGW}/zone-setup/address/single?${params}`
    : `${RC_API_BASE}/zone-setup/address?${params}`
  const res = await rcFetch(url)
  if (!res || !res.ok) return null  // null = API unreachable / server error
  const data = await res.json().catch(() => null)
  const results: unknown[] = Array.isArray(data) ? data : (data?.results ?? [])
  if (!results.length) return []   // [] = API responded but street not found
  const zones = (results[0] as Record<string, unknown>).zones as Record<string, string> | undefined
  if (!zones || !Object.keys(zones).length) return []
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
  const params = new URLSearchParams({
    project_id: rcCity.project_id,
    district_id: rcCity.district_id,
    zone_id: zoneId,
    lang_cd: 'en_US',
  })
  // US: zone/collections endpoint works on apigw; CA: api-city (redirects to ca-api-city)
  const url = rcCity.apigw_prefix === 'us'
    ? `${RC_US_APIGW}/zone-setup/zone/collections?${params}`
    : `${RC_API_BASE}/collections?${params}`
  const res = await rcFetch(url)
  const map = new Map<string, string>()
  if (!res || !res.ok) return map
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
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const params = new URLSearchParams({
    project_id: rcCity.project_id,
    district_id: rcCity.district_id,
    zone_id: zoneId,
    lang_cd: 'en_US',
    month: monthStr,
  })
  const res = await rcFetch(`${RC_API_BASE}/app_data_zone_schedules?${params}`)
  if (!res || !res.ok) return []
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
          const eventType = typeMap.size > 0 ? typeMap.get(String(col.id)) : 'pickup'
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
  daysAhead = 90,
): Promise<RCEvent[]> {
  const ids = Array.isArray(zoneIds) ? zoneIds : [zoneIds]
  const now = new Date()
  const endDate = new Date(now.getTime() + daysAhead * 86_400_000)
  const allEvents: RCEvent[] = []

  for (const zoneId of ids) {
    if (rcCity.apigw_prefix === 'us') {
      // US cities: build type map + single bulk schedule fetch from apigw
      const typeMap = await buildRCTypeMap(rcCity, zoneId)
      const params = new URLSearchParams({
        project_id: rcCity.project_id,
        district_id: rcCity.district_id,
        zone_id: zoneId,
      })
      const res = await rcFetch(`${RC_US_APIGW}/zone-setup/zone/schedules?${params}`)
      if (res?.ok) {
        const data = await res.json().catch(() => null)
        type Col = { id: number; status: string }
        type Evt = { date: string; collections: Col[] }
        type Mon = { month: number; events: Evt[] }
        type Yr  = { year: number; months: Mon[] }
        const dataArr = data?.DATA as Yr[] | undefined
        if (dataArr) {
          for (const yr of dataArr) {
            for (const mo of yr.months) {
              for (const evt of mo.events) {
                if (!evt.date) continue
                for (const col of evt.collections) {
                  const s = (col.status ?? '').toLowerCase()
                  if (s.includes('cancel') || s === 'suspended') continue
                  const eventType = typeMap.size > 0
                    ? typeMap.get(String(col.id))
                    : 'pickup'
                  if (eventType) allEvents.push({ date: evt.date, event_type: eventType })
                }
              }
            }
          }
        }
      }
    } else {
      // CA and other cities: month-by-month with type map
      const typeMap = await buildRCTypeMap(rcCity, zoneId)
      let cursor = new Date(now.getFullYear(), now.getMonth(), 1)
      while (cursor <= endDate) {
        const monthEvents = await fetchRCMonth(rcCity, zoneId, typeMap, cursor.getFullYear(), cursor.getMonth() + 1)
        allEvents.push(...monthEvents)
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
      }
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
  daysAhead = 90,
): Promise<RCResult | null> {
  const rcCity = await searchRCCity(city, state)
  if (!rcCity) return null
  const zoneIds = await lookupRCZone(rcCity, street)
  if (!zoneIds || !zoneIds.length) return null
  const events = await getEventsFromRCZone(rcCity, zoneIds, daysAhead)
  return { events, city: rcCity, zone_ids: zoneIds }
}
