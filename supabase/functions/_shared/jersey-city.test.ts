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
  const events = generateJCWeeklyEvents(['monday', 'thursday'], 'garbage', 14)
  if (events.length === 0) throw new Error('Expected some events')
  const types = [...new Set(events.map(e => e.event_type))]
  if (types.length !== 1 || types[0] !== 'garbage') throw new Error('Wrong event_type')
  for (let i = 1; i < events.length; i++) {
    if (events[i].date < events[i - 1].date) throw new Error('Events not sorted')
  }
})

Deno.test('generateJCWeeklyEvents: empty days returns empty array', () => {
  const events = generateJCWeeklyEvents([], 'recycling', 60)
  if (events.length !== 0) throw new Error('Expected empty array')
})

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

Deno.test('getJerseyCityEvents: returns garbage-only result when recycling zone missing', async () => {
  await withMockFetch({
    'nominatim.openstreetmap.org': [{ lat: '40.728', lon: '-74.077' }],
    'garbage-collection-map': { results: [{ name: 'Tuesday / Friday' }] },
    'recycling-collection-map': { results: [] },  // no recycling zone
  }, async () => {
    const result = await getJerseyCityEvents('100 Grove St', 'Jersey City', 'NJ', 14)
    if (!result) throw new Error('Expected result')
    if (result.garbage_days.length === 0) throw new Error('Expected garbage days')
    if (result.recycling_days.length !== 0) throw new Error('Expected empty recycling_days')
    const hasGarbage = result.events.some(e => e.event_type === 'garbage')
    const hasRecycling = result.events.some(e => e.event_type === 'recycling')
    if (!hasGarbage) throw new Error('Expected garbage events')
    if (hasRecycling) throw new Error('Expected no recycling events')
  })
})
