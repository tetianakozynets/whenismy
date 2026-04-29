import {
  isNYCAddress,
  parseDSNYDays,
  generateDSNYEvents,
  type DSNYZone,
} from './nyc-dsny.ts'

Deno.test('isNYCAddress: recognises NYC borough names', () => {
  for (const city of ['New York', 'Brooklyn', 'Manhattan', 'Bronx', 'Queens', 'Staten Island']) {
    if (!isNYCAddress(city, 'NY')) throw new Error(`Expected ${city} NY to be NYC`)
  }
})

Deno.test('isNYCAddress: rejects non-NYC NY cities', () => {
  if (isNYCAddress('Buffalo', 'NY')) throw new Error('Buffalo NY should not be NYC')
  if (isNYCAddress('Albany', 'NY')) throw new Error('Albany NY should not be NYC')
  if (isNYCAddress('New York', 'NJ')) throw new Error('New York NJ should not be NYC')
})

Deno.test('parseDSNYDays: parses single day', () => {
  const result = parseDSNYDays('Mon')
  if (result.length !== 1 || result[0] !== 'monday') throw new Error(`Expected ['monday'], got ${JSON.stringify(result)}`)
})

Deno.test('parseDSNYDays: parses multiple days', () => {
  const result = parseDSNYDays('Mon, Thu')
  if (result.length !== 2 || !result.includes('monday') || !result.includes('thursday')) throw new Error(`Wrong: ${JSON.stringify(result)}`)
})

Deno.test('parseDSNYDays: parses three days', () => {
  const result = parseDSNYDays('Mon, Wed, Fri')
  if (result.length !== 3) throw new Error(`Expected 3, got ${result.length}`)
})

Deno.test('parseDSNYDays: returns empty array for empty/null input', () => {
  if (parseDSNYDays('').length !== 0) throw new Error('Should be empty for ""')
  if (parseDSNYDays(null as unknown as string).length !== 0) throw new Error('Should be empty for null')
})

Deno.test('generateDSNYEvents: generates refuse + recycling events', () => {
  const zone: DSNYZone = {
    district: 'MN05', section: 'MN051',
    freq_refuse: 'Mon, Thu', freq_recycling: 'Mon',
    freq_organics: null, freq_bulk: 'Mon, Thu',
  }
  const start = new Date('2026-04-27T00:00:00') // Monday
  const events = generateDSNYEvents(zone, 14, start)
  const garbage = events.filter(e => e.event_type === 'garbage')
  const recycling = events.filter(e => e.event_type === 'recycling')
  // 14 days from Monday: 2 Mondays + 2 Thursdays = 4 garbage
  if (garbage.length !== 4) throw new Error(`Expected 4 garbage, got ${garbage.length}`)
  // 2 Mondays = 2 recycling
  if (recycling.length !== 2) throw new Error(`Expected 2 recycling, got ${recycling.length}`)
})

Deno.test('generateDSNYEvents: omits organics when freq_organics is null', () => {
  const zone: DSNYZone = {
    district: 'BK01', section: 'BK011',
    freq_refuse: 'Wed, Sat', freq_recycling: 'Wed',
    freq_organics: null, freq_bulk: 'Sat',
  }
  const events = generateDSNYEvents(zone, 7, new Date('2026-04-29T00:00:00'))
  if (events.some(e => e.event_type === 'organics')) throw new Error('Should not have organics')
})
