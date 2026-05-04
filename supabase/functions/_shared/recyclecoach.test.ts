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
      { id: 9999, name: 'Holiday' },
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
            '18': { is_none: true, ids: [2665] },
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

Deno.test('getEventsFromRCZone: date-range filter excludes past and far-future events', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  const typeMap = new Map([['2665', 'garbage']])

  // Build a schedule: one event far in the past, one today, one far in the future
  const now = new Date()
  function pad(n: number) { return String(n).padStart(2, '0') }
  function localStr(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const pastDate = new Date(now.getTime() - 10 * 86_400_000)   // 10 days ago
  const todayDate = new Date(now)
  const futureDate = new Date(now.getTime() + 5 * 86_400_000)  // 5 days from now
  const farFuture = new Date(now.getTime() + 90 * 86_400_000)  // 90 days (beyond daysAhead=30)

  const mockSchedule: Record<string, unknown> = {}
  mockSchedule[pad(pastDate.getDate())] = [2665]
  mockSchedule[pad(todayDate.getDate())] = [2665]
  mockSchedule[pad(futureDate.getDate())] = [2665]
  mockSchedule[pad(farFuture.getDate())] = [2665]

  // Only return one month — simplified to current month only
  const scheduleBody = {
    dates: { [String(now.getFullYear())]: { [pad(now.getMonth() + 1)]: mockSchedule } },
  }

  await withMockFetch({
    '/collections': [{ id: 2665, name: 'Garbage' }],
    'app_data_zone_schedules': scheduleBody,
  }, async () => {
    const events = await getEventsFromRCZone(city, 'zone-z14089', 30)
    const dates = events.map(e => e.date)
    if (dates.includes(localStr(pastDate))) throw new Error('Past event should be excluded')
    if (!dates.includes(localStr(todayDate))) throw new Error('Today event should be included')
    if (!dates.includes(localStr(futureDate))) throw new Error('Future (in-window) event should be included')
    // farFuture is in the same month but may fall outside the 30-day window depending on exact date;
    // at minimum verify no event is more than 30 days ahead
    for (const d of dates) {
      const eventMs = new Date(d + 'T12:00:00').getTime()
      if (eventMs > now.getTime() + 31 * 86_400_000) {
        throw new Error(`Event ${d} is beyond the 30-day window`)
      }
    }
  })
})

Deno.test('getEventsFromRCZone: deduplicates same date+type pairs', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }

  // Return duplicate collection IDs for the same day
  const now = new Date()
  function pad(n: number) { return String(n).padStart(2, '0') }
  const tomorrowDay = pad(new Date(now.getTime() + 86_400_000).getDate())
  const month = pad(now.getMonth() + 1)
  const year = String(now.getFullYear())

  await withMockFetch({
    '/collections': [{ id: 2665, name: 'Garbage' }],
    'app_data_zone_schedules': {
      dates: { [year]: { [month]: { [tomorrowDay]: [2665, 2665] } } },
    },
  }, async () => {
    const events = await getEventsFromRCZone(city, 'zone-z14089', 60)
    const garbageCount = events.filter(e => e.event_type === 'garbage').length
    if (garbageCount !== 1) throw new Error(`Expected 1 garbage event after dedup, got ${garbageCount}`)
  })
})
