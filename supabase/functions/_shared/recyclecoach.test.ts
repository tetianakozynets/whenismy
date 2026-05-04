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
  if (normalizeRCType('Grass Bags') !== 'yard_waste') throw new Error('grass bags → yard_waste')
  if (normalizeRCType('Bulk Items') !== 'bulk_waste') throw new Error('bulk_waste')
  if (normalizeRCType('Composting') !== 'organics') throw new Error('organics')
  if (normalizeRCType('Holiday') !== null) throw new Error('unknown should be null')
})

Deno.test('normalizeRCType: cancellations and closures return null', () => {
  for (const name of [
    'Saturday Recycling Cancelled - Mahwah',
    'Recycle Yard Closure',
    'HHW - Mahwah',
    'Mahwah Shred-It Event',
    'Garbage Cancelled - Holiday',
  ]) {
    const result = normalizeRCType(name)
    if (result !== null) throw new Error(`Expected null for "${name}", got "${result}"`)
  }
})

Deno.test('normalizeRCType: community drop-off events return null', () => {
  for (const name of [
    'Recycling Event - Mahwah',   // collection 2803 — drop-off event, not curbside
    'Recycling Event - Paramus',  // collection 2802
    'Recycle Event',
    'Electronics Drop-Off',
    'Tire Drop Off',
  ]) {
    const result = normalizeRCType(name)
    if (result !== null) throw new Error(`Expected null for "${name}", got "${result}"`)
  }
})

// ── API call tests ────────────────────────────────────────────────────────────
Deno.test('searchRCCity: returns RCCity on valid response', async () => {
  await withMockFetch({
    'city/search': [{ project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }],
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

Deno.test('lookupRCZone: returns single-element array for one zone', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  await withMockFetch({
    'zone-setup/address': { results: [{ zones: { '3800': 'z14089' } }] },
  }, async () => {
    const zoneIds = await lookupRCZone(city, '100 Broad St')
    if (!Array.isArray(zoneIds) || zoneIds.length !== 1) throw new Error(`Expected array of 1, got: ${JSON.stringify(zoneIds)}`)
    if (zoneIds[0] !== 'zone-z14089') throw new Error(`Wrong zone_id: ${zoneIds[0]}`)
  })
})

Deno.test('lookupRCZone: returns separate zone entries for multiple zones', async () => {
  const city: RCCity = { project_id: 'NJ_MON', district_id: 'FREEHOLD', apigw_prefix: 'us' }
  await withMockFetch({
    'zone-setup/address': { results: [{ zones: { '3800': 'z14089', '3801': 'z16205' } }] },
  }, async () => {
    const zoneIds = await lookupRCZone(city, '5 Main St')
    if (!Array.isArray(zoneIds) || zoneIds.length !== 2) throw new Error(`Expected array of 2, got: ${JSON.stringify(zoneIds)}`)
    if (!zoneIds.includes('zone-z14089') || !zoneIds.includes('zone-z16205')) {
      throw new Error(`Unexpected zone_ids: ${JSON.stringify(zoneIds)}`)
    }
  })
})

Deno.test('lookupRCZone: deduplicates identical zone values', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  await withMockFetch({
    'zone-setup/address': { results: [{ zones: { '3800': 'z14089', '3801': 'z14089' } }] },
  }, async () => {
    const zoneIds = await lookupRCZone(city, '200 Broad St')
    if (!Array.isArray(zoneIds) || zoneIds.length !== 1) throw new Error(`Expected deduped array of 1, got: ${JSON.stringify(zoneIds)}`)
    if (zoneIds[0] !== 'zone-z14089') throw new Error(`Wrong zone_id: ${zoneIds[0]}`)
  })
})

Deno.test('lookupRCZone: returns null when results empty', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  await withMockFetch({ 'zone-setup/address': { results: [] } }, async () => {
    const zoneIds = await lookupRCZone(city, '1 Unknown Pl')
    if (zoneIds !== null) throw new Error('Expected null')
  })
})

Deno.test('buildRCTypeMap: maps id strings to normalized event types', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  // Actual format: { collection: { types: { "collection-{id}": { title: "..." } } } }
  await withMockFetch({
    '/collections': {
      status: 'success',
      collection: {
        types: {
          'collection-2665': { title: 'Garbage' },
          'collection-4952': { title: 'Containers' },
          'collection-4953': { title: 'Paper and Boxes' },
          'collection-2661': { title: 'Bulk Items' },
          'collection-9999': { title: 'Holiday' },
        },
      },
    },
  }, async () => {
    const map = await buildRCTypeMap(city, 'zone-z14089')
    if (map.get('2665') !== 'garbage') throw new Error('garbage')
    if (map.get('4952') !== 'recycling') throw new Error('containers→recycling')
    if (map.get('4953') !== 'recycling') throw new Error('paper→recycling')
    if (map.get('2661') !== 'bulk_waste') throw new Error('bulk_waste')
    if (map.has('9999')) throw new Error('Holiday type should be excluded from map')
  })
})

Deno.test('fetchRCMonth: returns events, skipping cancelled status', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  const typeMap = new Map([['2665', 'garbage'], ['4952', 'recycling']])
  // Actual format: { DATA: [{ year, months: [{ month, events: [{ date, collections: [{ id, status }] }] }] }] }
  await withMockFetch({
    'app_data_zone_schedules': {
      DATA: [{
        year: 2026,
        months: [{
          month: 5,
          events: [
            { date: '2026-05-04', day: 4, collections: [{ id: 2665, status: '' }, { id: 4952, status: '' }] },
            { date: '2026-05-11', day: 11, collections: [{ id: 2665, status: '' }] },
            { date: '2026-05-18', day: 18, collections: [{ id: 2665, status: 'cancelled' }] }, // cancelled — skipped
          ],
        }],
      }],
    },
  }, async () => {
    const events = await fetchRCMonth(city, 'zone-z14089', typeMap, 2026, 5)
    if (events.length !== 3) throw new Error(`Expected 3 events, got ${events.length}`)
    const dates = events.map(e => e.date)
    if (!dates.includes('2026-05-04')) throw new Error('Missing 2026-05-04')
    if (!dates.includes('2026-05-11')) throw new Error('Missing 2026-05-11')
    if (dates.includes('2026-05-18')) throw new Error('Cancelled event should be excluded')
    const may4Events = events.filter(e => e.date === '2026-05-04')
    if (may4Events.length !== 2) throw new Error(`Expected 2 events on May 4, got ${may4Events.length}`)
  })
})

Deno.test('fetchRCMonth: keeps holiday-postponed events (non-cancel status)', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }
  const typeMap = new Map([['2665', 'garbage']])
  await withMockFetch({
    'app_data_zone_schedules': {
      DATA: [{
        year: 2026,
        months: [{
          month: 5,
          events: [
            { date: '2026-05-05', day: 5, collections: [{ id: 2665, status: 'postponed' }] }, // postponed — keep
            { date: '2026-05-06', day: 6, collections: [{ id: 2665, status: '' }] },           // normal — keep
          ],
        }],
      }],
    },
  }, async () => {
    const events = await fetchRCMonth(city, 'zone-z14089', typeMap, 2026, 5)
    const dates = events.map(e => e.date)
    if (!dates.includes('2026-05-05')) throw new Error('Postponed event should be included')
    if (!dates.includes('2026-05-06')) throw new Error('Normal event should be included')
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

  const now = new Date()
  function pad(n: number) { return String(n).padStart(2, '0') }
  function localStr(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }
  const pastDate = new Date(now.getTime() - 10 * 86_400_000)
  const todayDate = new Date(now)
  const futureDate = new Date(now.getTime() + 5 * 86_400_000)

  function makeEvent(d: Date) {
    return { date: localStr(d), day: d.getDate(), collections: [{ id: 2665, status: '' }] }
  }

  const scheduleBody = {
    DATA: [{
      year: now.getFullYear(),
      months: [{
        month: now.getMonth() + 1,
        events: [makeEvent(pastDate), makeEvent(todayDate), makeEvent(futureDate)],
      }],
    }],
  }

  await withMockFetch({
    '/collections': { status: 'success', collection: { types: { 'collection-2665': { title: 'Garbage' } } } },
    'app_data_zone_schedules': scheduleBody,
  }, async () => {
    const events = await getEventsFromRCZone(city, ['zone-z14089'], 30)
    const dates = events.map(e => e.date)
    if (dates.includes(localStr(pastDate))) throw new Error('Past event should be excluded')
    if (!dates.includes(localStr(todayDate))) throw new Error('Today event should be included')
    if (!dates.includes(localStr(futureDate))) throw new Error('Future (in-window) event should be included')
  })
})

Deno.test('getEventsFromRCZone: deduplicates same date+type pairs', async () => {
  const city: RCCity = { project_id: 'NJ_ESS', district_id: 'NEWARK', apigw_prefix: 'us' }

  const now = new Date()
  function pad(n: number) { return String(n).padStart(2, '0') }
  const tomorrow = new Date(now.getTime() + 86_400_000)
  function localStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

  await withMockFetch({
    '/collections': { status: 'success', collection: { types: { 'collection-2665': { title: 'Garbage' } } } },
    'app_data_zone_schedules': {
      DATA: [{
        year: now.getFullYear(),
        months: [{
          month: now.getMonth() + 1,
          events: [{
            date: localStr(tomorrow), day: tomorrow.getDate(),
            collections: [{ id: 2665, status: '' }, { id: 2665, status: '' }],  // duplicate
          }],
        }],
      }],
    },
  }, async () => {
    const events = await getEventsFromRCZone(city, ['zone-z14089'], 60)
    const garbageCount = events.filter(e => e.event_type === 'garbage').length
    if (garbageCount !== 1) throw new Error(`Expected 1 garbage event after dedup, got ${garbageCount}`)
  })
})
