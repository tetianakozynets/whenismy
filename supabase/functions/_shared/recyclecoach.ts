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
  zone_id: string
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
  if (!hit?.sku) return null
  const rawPrefix = String(hit.apigw_prefix ?? 'us')
  return {
    project_id: String(hit.sku),
    district_id: String(hit.district_id ?? ''),
    apigw_prefix: /^[a-z0-9-]{1,16}$/.test(rawPrefix) ? rawPrefix : 'us',
  }
}

export async function lookupRCZone(rcCity: RCCity, street: string): Promise<string | null> {
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
  return 'zone-' + Object.values(zones).sort().join('-')
}

export function normalizeRCType(name: string): string | null {
  const n = name.toLowerCase()
  if (n.includes('garbage') || n.includes('trash') || n.includes('refuse') || n.includes('rubbish')) return 'garbage'
  if (n.includes('recycl') || n.includes('container') || n.includes('paper') || n.includes('glass') || n.includes('metal')) return 'recycling'
  if (n.includes('yard') || n.includes('leaf') || n.includes('brush') || n.includes('vegetation')) return 'yard_waste'
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
  const collections: unknown[] = Array.isArray(data) ? data : (data?.collections ?? [])
  for (const c of collections) {
    const col = c as Record<string, unknown>
    const et = normalizeRCType(String(col.name ?? ''))
    if (et && col.id != null) map.set(String(col.id), et)
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
  const yearMap = (data.dates ?? data) as Record<string, unknown>
  const monthPadded = String(month).padStart(2, '0')
  const monthData =
    (yearMap[String(year)] as Record<string, unknown> | undefined)?.[monthPadded] ??
    (yearMap[String(year)] as Record<string, unknown> | undefined)?.[String(month)]
  if (!monthData || typeof monthData !== 'object') return []

  const events: RCEvent[] = []
  for (const [day, value] of Object.entries(monthData as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Array.isArray(value) &&
        (value as Record<string, unknown>).is_none) continue
    const ids: string[] = Array.isArray(value) ? value.map(String) : []
    const dateStr = `${year}-${monthPadded}-${day.padStart(2, '0')}`
    for (const id of ids) {
      const eventType = typeMap.get(id)
      if (eventType) events.push({ date: dateStr, event_type: eventType })
    }
  }
  return events
}

export async function getEventsFromRCZone(
  rcCity: RCCity,
  zoneId: string,
  daysAhead = 60,
): Promise<RCEvent[]> {
  const typeMap = await buildRCTypeMap(rcCity, zoneId)
  if (!typeMap.size) return []
  const now = new Date()
  const endDate = new Date(now.getTime() + daysAhead * 86_400_000)
  const events: RCEvent[] = []
  let cursor = new Date(now.getFullYear(), now.getMonth(), 1)
  while (cursor <= endDate) {
    const monthEvents = await fetchRCMonth(rcCity, zoneId, typeMap, cursor.getFullYear(), cursor.getMonth() + 1)
    events.push(...monthEvents)
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
  }
  function localStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const todayStr = localStr(now)
  const endStr = localStr(endDate)
  const seen = new Set<string>()
  return events
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
  const zoneId = await lookupRCZone(rcCity, street)
  if (!zoneId) return null
  const events = await getEventsFromRCZone(rcCity, zoneId, daysAhead)
  return { events, city: rcCity, zone_id: zoneId }
}
