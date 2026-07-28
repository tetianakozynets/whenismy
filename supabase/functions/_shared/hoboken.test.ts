// supabase/functions/_shared/hoboken.test.ts
import { generateHobokenEvents } from './hoboken.ts'

Deno.test('generateHobokenEvents: produces all 4 event types within a 14-day window', () => {
  const events = generateHobokenEvents(14)
  const types = new Set(events.map(e => e.event_type))
  for (const t of ['garbage', 'recycling', 'bulk_waste', 'yard_waste']) {
    if (!types.has(t)) throw new Error(`Missing event type: ${t}`)
  }
})

Deno.test('generateHobokenEvents: garbage occurs 3x/week, more often than recycling', () => {
  const events = generateHobokenEvents(14)
  const garbage = events.filter(e => e.event_type === 'garbage')
  const recycling = events.filter(e => e.event_type === 'recycling')
  if (garbage.length <= recycling.length) {
    throw new Error(`Expected more garbage events than recycling, got ${garbage.length} vs ${recycling.length}`)
  }
})

Deno.test('generateHobokenEvents: events are sorted by date', () => {
  const events = generateHobokenEvents(30)
  for (let i = 1; i < events.length; i++) {
    if (events[i].date < events[i - 1].date) throw new Error('Events not sorted')
  }
})

Deno.test('generateHobokenEvents: all dates fall within the requested window', () => {
  const events = generateHobokenEvents(14)
  const cutoff = new Date(Date.now() + 14 * 86_400_000)
  for (const e of events) {
    if (new Date(e.date + 'T12:00:00') > cutoff) throw new Error(`Event ${e.date} beyond 14-day window`)
  }
})
