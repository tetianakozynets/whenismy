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
  function localDateStr(offsetDays = 0): string {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + offsetDays)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  it('returns 0 for today', () => {
    expect(daysUntil(localDateStr(0))).toBe(0)
  })

  it('returns 1 for tomorrow', () => {
    expect(daysUntil(localDateStr(1))).toBe(1)
  })
})

describe('daysUntilLabel', () => {
  it('returns "Today" for 0', () => expect(daysUntilLabel(0)).toBe('Today'))
  it('returns "Tomorrow" for 1', () => expect(daysUntilLabel(1)).toBe('Tomorrow'))
  it('returns "In N days" for anything else', () => expect(daysUntilLabel(7)).toBe('In 7 days'))
})
