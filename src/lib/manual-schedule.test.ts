import { ManualScheduleInput } from './types'

// Mock supabase to avoid initialization errors in tests
jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

import { generateEventsFromManual } from './manual-schedule'

const weeklyGarbage: ManualScheduleInput = {
  event_type: 'garbage',
  pickup_day: 'monday',
  frequency: 'weekly',
  anchor_date: null,
}

const biweeklyRecycling: ManualScheduleInput = {
  event_type: 'recycling',
  pickup_day: 'friday',
  frequency: 'biweekly',
  anchor_date: '2026-05-08', // a Friday
}

it('generates weekly events for 60 days', () => {
  const events = generateEventsFromManual(weeklyGarbage, 60, new Date('2026-05-02'))
  expect(events.length).toBeGreaterThanOrEqual(8)
  expect(events.every(e => e.event_type === 'garbage')).toBe(true)
  // All events should be on a Monday (getDay() === 1)
  expect(events.every(e => new Date(e.date + 'T12:00:00').getDay() === 1)).toBe(true)
})

it('generates biweekly events on every other pickup_day', () => {
  const events = generateEventsFromManual(biweeklyRecycling, 60, new Date('2026-05-02'))
  expect(events.length).toBeGreaterThanOrEqual(4)
  expect(events.length).toBeLessThan(6)
  expect(events.every(e => e.event_type === 'recycling')).toBe(true)
  // All on Fridays (getDay() === 5)
  expect(events.every(e => new Date(e.date + 'T12:00:00').getDay() === 5)).toBe(true)
  // Dates 14 days apart
  for (let i = 1; i < events.length; i++) {
    const diff = (new Date(events[i].date).getTime() - new Date(events[i - 1].date).getTime()) / 86400000
    expect(diff).toBe(14)
  }
})

it('returns empty array when anchor_date missing for biweekly', () => {
  const events = generateEventsFromManual({ ...biweeklyRecycling, anchor_date: null }, 60, new Date('2026-05-02'))
  expect(events).toEqual([])
})
