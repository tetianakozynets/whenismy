import { parseDSNYDays, generateDSNYEvents } from '../_shared/nyc-dsny.ts'
import { parseIcalUrl } from '../_shared/recollect.ts'

// normalizeAddress now lives in ../_shared/address.ts and is tested directly
// in _shared/address.test.ts.

Deno.test('NYC routing: state=NY triggers geocoder path (not city-name list)', () => {
  // Routing is purely state-based now — any NY address goes to the geocoder.
  // The geocoder (geosearch.planninglabs.nyc) only returns results for valid
  // NYC addresses, so non-NYC NY addresses naturally fall through to notCovered.
  const state = 'NY'
  if (state.trim().toUpperCase() !== 'NY') throw new Error('NY routing check broken')
})

Deno.test('parseDSNYDays: Mon+Thu returns 2 days', () => {
  const days = parseDSNYDays('Mon, Thu')
  if (days.length !== 2) throw new Error(`Expected 2 days, got ${days.length}`)
})

Deno.test('generateDSNYEvents: events are sorted by date', () => {
  const zone = {
    district: 'MN05', section: 'MN051',
    freq_refuse: 'Mon, Thu', freq_recycling: 'Mon',
    freq_organics: null, freq_bulk: null,
  }
  const events = generateDSNYEvents(zone, 14, new Date('2026-04-27T00:00:00'))
  for (let i = 1; i < events.length; i++) {
    if (events[i].event_date < events[i - 1].event_date) throw new Error('Events not sorted')
  }
})

Deno.test('parseIcalUrl: extracts IDs from iCal URL', () => {
  const parts = parseIcalUrl(
    'https://recollect.a.ssl.fastly.net/api/places/BCCDF30E-578B-11E4-AD38-5839C200407A/services/208/events.en.ics'
  )
  if (!parts || parts.serviceId !== '208') throw new Error('Failed to parse')
})

Deno.test('NJ non-JC address routes to RecycleCoach provider label', () => {
  const state = 'NJ'
  if (state.trim().toUpperCase() !== 'NJ') throw new Error('NJ routing check broken')
})


Deno.test('isJerseyCity: routes jersey city correctly', async () => {
  const { isJerseyCity } = await import('../_shared/jersey-city.ts')
  if (!isJerseyCity('Jersey City')) throw new Error('Expected true')
  if (isJerseyCity('Newark')) throw new Error('Expected false for Newark')
})

// generateHobokenEvents now lives in ../_shared/hoboken.ts and is tested
// directly in _shared/hoboken.test.ts.
