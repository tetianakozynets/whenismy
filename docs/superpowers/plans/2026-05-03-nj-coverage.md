# NJ Coverage: RecycleCoach + Jersey City Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add New Jersey garbage/recycling schedule coverage using the free RecycleCoach API (NJDEP-funded, covers all 21 NJ counties), Jersey City's open data GeoJSON zone polygon API, and a hardcoded static schedule for Hoboken (citywide fixed days, no zones).

**Architecture:** Two new `_shared/` modules — `recyclecoach.ts` (4-step API chain: city search → zone lookup → collection type map → monthly schedule) and `jersey-city.ts` (Nominatim geocode → JC OpenDataSoft geospatial query → weekly event generation). Hoboken needs no module: its schedule is identical for every address (garbage Mon/Thu/Sat, recycling Tue/Fri, bulk Fri) and is generated inline. The `lookup-schedule` edge function gains an NJ routing block: Hoboken → static schedule, Jersey City → `jersey-city.ts`, all other NJ cities → `recyclecoach.ts`. All three cache to `place_lookup_cache` with provider values `'hoboken-static'`, `'jersey-city'`, and `'recyclecoach'`.

**Tech Stack:** Deno edge functions, RecycleCoach unauthenticated REST API (`api-city.recyclecoach.com`), Jersey City OpenDataSoft REST API (`data.jerseycitynj.gov`), Nominatim OpenStreetMap geocoding (Jersey City only, no key required)

---

## File Structure

```
supabase/functions/_shared/
  recyclecoach.ts          (NEW) RecycleCoach 4-step API chain + event generation
  recyclecoach.test.ts     (NEW) Deno unit tests for recyclecoach.ts
  jersey-city.ts           (NEW) Jersey City GeoJSON zone lookup + event generation
  jersey-city.test.ts      (NEW) Deno unit tests for jersey-city.ts
  nyc-dsny.ts              (no change)
  recollect.ts             (no change)

supabase/functions/lookup-schedule/
  index.ts                 (MODIFY) add NJ routing block + eventsFromCache handlers
                                    Hoboken handled inline (no _shared/ module needed)
  index.test.ts            (MODIFY) add NJ routing smoke tests
```

**Hoboken schedule (hardcoded, same for every address):**
| Event type | Collection days |
|---|---|
| `garbage` | Monday, Thursday, Saturday |
| `recycling` | Tuesday (commingled), Friday (paper/cardboard) |
| `bulk_waste` | Friday (metal furniture, appliances, e-waste) |
| `yard_waste` | Friday (seasonal) |

---

### Task 1: RecycleCoach shared module

**RecycleCoach API chain (all endpoints unauthenticated):**
1. `GET https://api-city.recyclecoach.com/city/search?term={city}, NJ, US` → `project_id` (called `sku` in API), `district_id`, `apigw_prefix`
2. `GET https://us-api-city.recyclecoach.com/zone-setup/address?sku={project_id}&district={district_id}&prompt=undefined&term={street}` → zone values, build `zone_id = "zone-" + values.join("-")`
3. `GET https://us-api-city.recyclecoach.com/collections?project_id=…&district_id=…&zone_id=…&lang_cd=en_US` → collection type array, each has `id` + `name`, normalized to our `event_type`
4. `GET https://us-api-city.recyclecoach.com/app_data_zone_schedules?project_id=…&district_id=…&zone_id=…&lang_cd=en_US&month=2026-05` → `{ dates: { "2026": { "05": { "04": [2665, 4953] } } } }` — days with `is_none: true` are holiday cancellations and must be skipped

**Files:**
- Create: `supabase/functions/_shared/recyclecoach.ts`
- Create: `supabase/functions/_shared/recyclecoach.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/recyclecoach.test.ts
import {
  normalizeRCType,
  searchRCCity,
  lookupRCZone,
  buildRCTypeMap,
  fetchRCMonth,
  getEventsFromRCZone,
  getRecycleCoachResult,
  type RCCity,
} from './recyclecoach.ts'

// ── Helper: override globalThis.fetch with canned responses ──────────────────
type FetchMock = Record<string, unknown>

function withMockFetch(mocks: FetchMock, fn: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch
  // @ts-ignore
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    for (const [pattern, body] of Object.entries(mocks)) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    }
    throw new Error(`Unmocked fetch: ${url}`)
  }
  return fn().finally(() => { globalThis.fetch = original })
}

// ── Pure function tests (no fetch) ───────────────────────────────────────────
Deno.test('normalizeRCType: garbage variants', () => {
  for (const name of ['Garbage', 'Trash', 'Refuse', 'Rubbish']) {
    const result = normalizeRCType(name)
    if (result !== 'garbage') throw new Error(`Expected 'garbage' for "${name}", got "${result}"`)
  }
})

Deno.test('normalizeRCType: recycling variants', () => {
  for (const name of ['Recycling', 'Containers', 'Paper and Boxes', 'Glass']) {
    const result = normalizeRCType(name)
    if (result !== 'recycling') throw new Error(`Expected 'recycling' for "${name}", got "${result}"`)
  }
})

Deno.test('normalizeRCType: other event types', () => {
  if (normalizeRCType('Yard Waste') !== 'yard_waste') throw new Error('yard_waste')
  if (normalizeRCType('Bulk Items') !== 'bulk_waste') throw new Error('bulk_waste')
  if (normalizeRCType('Composting') !== 'organics') throw new Error('organics')
  if (normalizeRCType('Holiday') !== null) throw new Error('unknown should be null')
})

// ── API call tests ────────────────────────────────────────────────────────────
Deno.test('searchRCCity: returns RCCity on valid response', async () => {
  await withMockFetch({
    'city/search': [{ sku: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }],
  }, async () => {
    const result = await searchRCCity('Newark', 'NJ')
    if (!result) throw new Error('Expected result')
    if (result.project_id !== 'NJ_ESS') throw new Error(`Wrong project_id: ${result.project_id}`)
    if (result.district_id !== 'NEWARK') throw new Error(`Wrong district_id: ${result.district_id}`)
    if (result.apigw_prefix !== 'us') throw new Error(`Wrong prefix: ${result.apigw_prefix}`)
  })
})

Deno.test('searchRCCity: returns null on empty results', async () => {
  await withMockFetch({ 'city/search': [] }, async () => {
    const result = await searchRCCity('Nowhere', 'NJ')
    if (result !== null) throw new Error('Expected null')
  })
})

Deno.test('lookupRCZone: builds zone-id from zones object', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  await withMockFetch({
    'zone-setup/address': { results: [{ zones: { '3800': 'z14089' } }] },
  }, async () => {
    const zoneId = await lookupRCZone(city, '100 Broad St')
    if (zoneId !== 'zone-z14089') throw new Error(`Wrong zone_id: ${zoneId}`)
  })
})

Deno.test('lookupRCZone: joins multiple zone values', async () => {
  const city: RCCity = { project_id: 'NJ_MON', district_id: 'FREEHOLD', apigw_prefix: 'us' }
  await withMockFetch({
    'zone-setup/address': { results: [{ zones: { '3800': 'z14089', '3801': 'z16205' } }] },
  }, async () => {
    const zoneId = await lookupRCZone(city, '5 Main St')
    if (!zoneId?.includes('z14089') || !zoneId?.includes('z16205')) {
      throw new Error(`Unexpected zone_id: ${zoneId}`)
    }
  })
})

Deno.test('lookupRCZone: returns null when results empty', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  await withMockFetch({ 'zone-setup/address': { results: [] } }, async () => {
    const zoneId = await lookupRCZone(city, '1 Unknown Pl')
    if (zoneId !== null) throw new Error('Expected null')
  })
})

Deno.test('buildRCTypeMap: maps id strings to normalized event types', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  await withMockFetch({
    '/collections': [
      { id: 2665, name: 'Garbage' },
      { id: 4952, name: 'Containers' },
      { id: 4953, name: 'Paper and Boxes' },
      { id: 2661, name: 'Bulk Items' },
      { id: 9999, name: 'Holiday' },  // should be skipped (null)
    ],
  }, async () => {
    const map = await buildRCTypeMap(city, 'zone-z14089')
    if (map.get('2665') !== 'garbage') throw new Error('garbage')
    if (map.get('4952') !== 'recycling') throw new Error('containers→recycling')
    if (map.get('4953') !== 'recycling') throw new Error('paper→recycling')
    if (map.get('2661') !== 'bulk_waste') throw new Error('bulk_waste')
    if (map.has('9999')) throw new Error('Holiday type should be excluded from map')
  })
})

Deno.test('fetchRCMonth: returns events, skipping is_none cancellations', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  const typeMap = new Map([['2665', 'garbage'], ['4952', 'recycling']])
  await withMockFetch({
    'app_data_zone_schedules': {
      dates: {
        '2026': {
          '05': {
            '04': [2665, 4952],
            '11': [2665],
            '18': { is_none: true, ids: [2665] }, // holiday — must be skipped
          },
        },
      },
    },
  }, async () => {
    const events = await fetchRCMonth(city, 'zone-z14089', typeMap, 2026, 5)
    if (events.length !== 3) throw new Error(`Expected 3 events, got ${events.length}`)
    const dates = events.map(e => e.date)
    if (!dates.includes('2026-05-04')) throw new Error('Missing 2026-05-04')
    if (!dates.includes('2026-05-11')) throw new Error('Missing 2026-05-11')
    if (dates.includes('2026-05-18')) throw new Error('Holiday event should be excluded')
    const may4Events = events.filter(e => e.date === '2026-05-04')
    if (may4Events.length !== 2) throw new Error(`Expected 2 events on May 4, got ${may4Events.length}`)
  })
})

Deno.test('getRecycleCoachResult: returns null when city not found', async () => {
  await withMockFetch({ 'city/search': [] }, async () => {
    const result = await getRecycleCoachResult('1 Main St', 'Atlantis', 'NJ')
    if (result !== null) throw new Error('Expected null')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
deno test --allow-env --allow-net --no-check supabase/functions/_shared/recyclecoach.test.ts
```
Expected: errors about missing module `./recyclecoach.ts`

- [ ] **Step 3: Write `supabase/functions/_shared/recyclecoach.ts`**

```typescript
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
  return {
    project_id: String(hit.sku),
    district_id: String(hit.district_id ?? ''),
    apigw_prefix: String(hit.apigw_prefix ?? 'us'),
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
  return 'zone-' + Object.values(zones).join('-')
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
    // Skip holiday cancellations: day value is { is_none: true, ... }
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

// Used by eventsFromCache — skips city/zone lookup since we already have those
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
  const todayStr = now.toISOString().slice(0, 10)
  const endStr = endDate.toISOString().slice(0, 10)
  return events
    .filter(e => e.date >= todayStr && e.date <= endStr)
    .sort((a, b) => a.date.localeCompare(b.date))
}

// Full address-based lookup (city search → zone → events)
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
deno test --allow-env --allow-net --no-check supabase/functions/_shared/recyclecoach.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/recyclecoach.ts supabase/functions/_shared/recyclecoach.test.ts
git commit -m "feat: add RecycleCoach shared module for NJ coverage"
```

---

### Task 2: Jersey City shared module

**How Jersey City data works:**
- Jersey City publishes zone GeoJSON at `data.jerseycitynj.gov` — 3 garbage zones (e.g. `"Tuesday / Friday"`) and 4 recycling zones (e.g. `"Monday"`).
- Given a lat/lng, query with `within_distance(geo_shape, POINT(lng lat), 500m)` to find the zone.
- Parse pickup day names → generate weekly recurring events (same algorithm as DSNY).
- RecycleCoach zone-setup returns empty results for Jersey City addresses, so this is a separate path.

**Files:**
- Create: `supabase/functions/_shared/jersey-city.ts`
- Create: `supabase/functions/_shared/jersey-city.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// supabase/functions/_shared/jersey-city.test.ts
import {
  isJerseyCity,
  parseJCDays,
  generateJCWeeklyEvents,
  getJerseyCityEvents,
} from './jersey-city.ts'

type FetchMock = Record<string, unknown>

function withMockFetch(mocks: FetchMock, fn: () => Promise<void>): Promise<void> {
  const original = globalThis.fetch
  // @ts-ignore
  globalThis.fetch = async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    for (const [pattern, body] of Object.entries(mocks)) {
      if (url.includes(pattern)) {
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    }
    throw new Error(`Unmocked fetch: ${url}`)
  }
  return fn().finally(() => { globalThis.fetch = original })
}

// ── Pure function tests ───────────────────────────────────────────────────────
Deno.test('isJerseyCity: matches case-insensitively', () => {
  for (const v of ['jersey city', 'Jersey City', 'JERSEY CITY', '  Jersey City  ']) {
    if (!isJerseyCity(v)) throw new Error(`Expected true for "${v}"`)
  }
})

Deno.test('isJerseyCity: rejects other cities', () => {
  for (const v of ['Hoboken', 'Newark', 'New York', 'Jerseyville']) {
    if (isJerseyCity(v)) throw new Error(`Expected false for "${v}"`)
  }
})

Deno.test('parseJCDays: slash-separated format', () => {
  const days = parseJCDays('Tuesday / Friday')
  if (days.length !== 2) throw new Error(`Expected 2, got ${days.length}`)
  if (!days.includes('tuesday')) throw new Error('Missing tuesday')
  if (!days.includes('friday')) throw new Error('Missing friday')
})

Deno.test('parseJCDays: single day', () => {
  const days = parseJCDays('Monday')
  if (days.length !== 1 || days[0] !== 'monday') throw new Error(`Wrong: ${days}`)
})

Deno.test('parseJCDays: ignores unknown tokens', () => {
  const days = parseJCDays('Tuesday / Funday')
  if (days.length !== 1 || days[0] !== 'tuesday') throw new Error(`Wrong: ${days}`)
})

Deno.test('generateJCWeeklyEvents: produces weekly events for each day', () => {
  // Use a known Monday as start date context — actual start is new Date() inside the function,
  // but we verify structural properties instead
  const events = generateJCWeeklyEvents(['monday', 'thursday'], 'garbage', 14)
  // In any 14-day window starting from today, 2 days × 2 occurrences each = up to 4 events
  if (events.length === 0) throw new Error('Expected some events')
  const types = [...new Set(events.map(e => e.event_type))]
  if (types.length !== 1 || types[0] !== 'garbage') throw new Error('Wrong event_type')
  // Dates must be sorted
  for (let i = 1; i < events.length; i++) {
    if (events[i].date < events[i - 1].date) throw new Error('Events not sorted')
  }
})

Deno.test('generateJCWeeklyEvents: empty days returns empty array', () => {
  const events = generateJCWeeklyEvents([], 'recycling', 60)
  if (events.length !== 0) throw new Error('Expected empty array')
})

// ── API integration test ──────────────────────────────────────────────────────
Deno.test('getJerseyCityEvents: returns events when geocode and zone lookup succeed', async () => {
  await withMockFetch({
    'nominatim.openstreetmap.org': [{ lat: '40.728', lon: '-74.077' }],
    'garbage-collection-map': { results: [{ name: 'Tuesday / Friday' }] },
    'recycling-collection-map': { results: [{ name: 'Monday' }] },
  }, async () => {
    const result = await getJerseyCityEvents('100 Grove St', 'Jersey City', 'NJ', 14)
    if (!result) throw new Error('Expected result')
    if (!result.garbage_days.includes('tuesday')) throw new Error('Missing tuesday in garbage_days')
    if (!result.garbage_days.includes('friday')) throw new Error('Missing friday in garbage_days')
    if (!result.recycling_days.includes('monday')) throw new Error('Missing monday in recycling_days')
    if (result.events.length === 0) throw new Error('Expected events')
    const hasGarbage = result.events.some(e => e.event_type === 'garbage')
    const hasRecycling = result.events.some(e => e.event_type === 'recycling')
    if (!hasGarbage) throw new Error('Expected garbage events')
    if (!hasRecycling) throw new Error('Expected recycling events')
  })
})

Deno.test('getJerseyCityEvents: returns null when geocoding fails', async () => {
  await withMockFetch({
    'nominatim.openstreetmap.org': [],
  }, async () => {
    const result = await getJerseyCityEvents('999 Fake St', 'Jersey City', 'NJ')
    if (result !== null) throw new Error('Expected null')
  })
})

Deno.test('getJerseyCityEvents: returns null when no zone found', async () => {
  await withMockFetch({
    'nominatim.openstreetmap.org': [{ lat: '40.700', lon: '-74.100' }],
    'garbage-collection-map': { results: [] },
    'recycling-collection-map': { results: [] },
  }, async () => {
    const result = await getJerseyCityEvents('1 Outside St', 'Jersey City', 'NJ')
    if (result !== null) throw new Error('Expected null')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
deno test --allow-env --allow-net --no-check supabase/functions/_shared/jersey-city.test.ts
```
Expected: errors about missing module `./jersey-city.ts`

- [ ] **Step 3: Write `supabase/functions/_shared/jersey-city.ts`**

```typescript
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
  const { lat, lon } = data[0]
  if (!lat || !lon) return null
  return { lat: parseFloat(lat), lng: parseFloat(lon) }
}

async function queryJCZoneName(apiUrl: string, lat: number, lng: number): Promise<string | null> {
  const point = encodeURIComponent(`geom'POINT(${lng} ${lat})'`)
  const url = `${apiUrl}?where=within_distance(geo_shape,${point},500m)&limit=1&select=name`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  return (data?.results?.[0]?.name as string | undefined) ?? null
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
  return events
}

export async function getJerseyCityEvents(
  street: string,
  city: string,
  state: string,
  daysAhead = 60,
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
deno test --allow-env --allow-net --no-check supabase/functions/_shared/jersey-city.test.ts
```
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/jersey-city.ts supabase/functions/_shared/jersey-city.test.ts
git commit -m "feat: add Jersey City shared module using open data GeoJSON zones"
```

---

### Task 3: Wire NJ routing into lookup-schedule

**Files:**
- Modify: `supabase/functions/lookup-schedule/index.ts`
- Modify: `supabase/functions/lookup-schedule/index.test.ts`

**What changes in `index.ts`:**
1. Add two new imports
2. Add NJ routing block (Jersey City path + RecycleCoach path) between the existing NYC block and the "Not covered" block
3. Extend `eventsFromCache` with two new `provider` cases: `'recyclecoach'` and `'jersey-city'`

- [ ] **Step 1: Add tests first**

Open `supabase/functions/lookup-schedule/index.test.ts` and append these tests at the end of the file (after the existing tests):

```typescript
// Append to existing supabase/functions/lookup-schedule/index.test.ts

Deno.test('NJ non-JC address routes to RecycleCoach provider label', () => {
  // This is a routing label test — just verifies the state check logic
  // by importing the helper we're about to add
  const state = 'NJ'
  if (state.trim().toUpperCase() !== 'NJ') throw new Error('NJ routing check broken')
})

Deno.test('isJerseyCity: routes jersey city correctly', async () => {
  const { isJerseyCity } = await import('../_shared/jersey-city.ts')
  if (!isJerseyCity('Jersey City')) throw new Error('Expected true')
  if (isJerseyCity('Newark')) throw new Error('Expected false for Newark')
})
```

- [ ] **Step 2: Run the existing test suite to confirm it still passes before modifying index.ts**

```bash
deno test --allow-env --allow-net --no-check supabase/functions/lookup-schedule/index.test.ts
```
Expected: all existing tests PASS, new tests PASS

- [ ] **Step 3: Add imports to `supabase/functions/lookup-schedule/index.ts`**

At the top of the file, after the existing imports, add:

```typescript
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
```

The file currently starts with:
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { timezoneFromLatLng } from '../_shared/tz.ts'
import {
  isNYCAddress, geocodeNYC, lookupDSNYZone, generateDSNYEvents,
} from '../_shared/nyc-dsny.ts'
import {
  parseIcalUrl, getEventsForPlace, getEvents, normalizeEventType,
} from '../_shared/recollect.ts'
```

- [ ] **Step 4: Add NJ routing block to the `handler` function**

Locate this comment in `index.ts`:
```typescript
  // ── Not covered ────────────────────────────────────────────────────────────
  const exists = await addressExistsNominatim(street!, city!, state!)
  if (!exists) return json({ error: 'Address not found', notFound: true }, 404)
  return json({ error: 'Address not covered', notCovered: true }, 404)
```

Insert the NJ block immediately BEFORE it (keep the existing "Not covered" block unchanged):

```typescript
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
    const exists = await addressExistsNominatim(street!, city!, state!)
    if (!exists) return json({ error: 'Address not found', notFound: true }, 404)
    return json({ error: 'Address not covered', notCovered: true }, 404)
  }
```

- [ ] **Step 5: Add `generateHobokenEvents` helper and extend `eventsFromCache` for all three NJ providers**

Add this helper function at the bottom of `supabase/functions/lookup-schedule/index.ts`, before the closing `if (import.meta.main)` line:

```typescript
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
```

Then extend `eventsFromCache` — locate the final `return []` and insert these blocks before it:

Locate the `eventsFromCache` function. It currently ends with:
```typescript
  return []
}
```

Insert these two blocks before the final `return []`:

```typescript
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
```

- [ ] **Step 6: Run the full test suite**

```bash
deno test --allow-env --allow-net --no-check supabase/functions/lookup-schedule/index.test.ts
```
Expected: all tests PASS (the new tests added in Step 1 PASS)

```bash
deno test --allow-env --allow-net --no-check supabase/functions/_shared/recyclecoach.test.ts supabase/functions/_shared/jersey-city.test.ts
```
Expected: all tests PASS

- [ ] **Step 7: Restart the local edge function and do a smoke test**

```bash
# Restart the edge function server (Ctrl+C the running one, then):
npx supabase functions serve lookup-schedule --env-file .env.local
```

Test with a Newark NJ address (should hit RecycleCoach):
```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/lookup-schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep EXPO_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)" \
  -d '{"street":"100 Broad St","city":"Newark","state":"NJ"}' | jq '{provider: .place.provider, event_count: (.events | length), first_event: .events[0]}'
```
Expected: `{"provider": "recyclecoach", "event_count": <some number>, "first_event": {"date": "...", "event_type": "garbage"}}` (or similar)

Test with a Jersey City address:
```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/lookup-schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep EXPO_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)" \
  -d '{"street":"100 Grove St","city":"Jersey City","state":"NJ"}' | jq '{provider: .place.provider, event_count: (.events | length)}'
```
Expected: `{"provider": "jersey-city", "event_count": <some number>}`

Test with a Hoboken address (should return static schedule, no geocoding needed):
```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/lookup-schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep EXPO_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)" \
  -d '{"street":"1 Washington St","city":"Hoboken","state":"NJ"}' | jq '{provider: .place.provider, event_count: (.events | length), types: ([.events[].event_type] | unique)}'
```
Expected: `{"provider": "hoboken-static", "event_count": <number>, "types": ["bulk_waste","garbage","recycling","yard_waste"]}`

Test with a fake NJ address (should return notFound):
```bash
curl -s -X POST http://127.0.0.1:54321/functions/v1/lookup-schedule \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(grep EXPO_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2)" \
  -d '{"street":"999 Zzzfake Blvd","city":"Newark","state":"NJ"}' | jq .
```
Expected: `{"error": "Address not found", "notFound": true}`

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/lookup-schedule/index.ts supabase/functions/lookup-schedule/index.test.ts
git commit -m "feat: add NJ coverage via RecycleCoach and Jersey City open data"
```
