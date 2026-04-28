import {
  eventTypeLabel,
  formatPickupDate,
  daysUntil,
  daysUntilLabel,
} from './formatting'

describe('eventTypeLabel', () => {
  it('returns Garbage for garbage', () => expect(eventTypeLabel('garbage')).toBe('Garbage'))
  it('returns Recycling for recycling', () => expect(eventTypeLabel('recycling')).toBe('Recycling'))
  it('returns Yard Waste for yard_waste', () => expect(eventTypeLabel('yard_waste')).toBe('Yard Waste'))
  it('title-cases unknown types', () => expect(eventTypeLabel('bulk_pickup')).toBe('Bulk Pickup'))
})

describe('formatPickupDate', () => {
  it('formats YYYY-MM-DD to a readable date string', () => {
    const result = formatPickupDate('2026-04-28')
    // Result varies by locale/system but should contain the day number
    expect(result).toMatch(/28/)
  })
})

describe('daysUntil', () => {
  it('returns 0 for today', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(daysUntil(today)).toBe(0)
  })

  it('returns 1 for tomorrow', () => {
    const tomorrow = new Date(Date.now() + 86400_000).toISOString().slice(0, 10)
    expect(daysUntil(tomorrow)).toBe(1)
  })
})

describe('daysUntilLabel', () => {
  it('returns "Today" for 0', () => expect(daysUntilLabel(0)).toBe('Today'))
  it('returns "Tomorrow" for 1', () => expect(daysUntilLabel(1)).toBe('Tomorrow'))
  it('returns "In N days" for anything else', () => expect(daysUntilLabel(7)).toBe('In 7 days'))
})
