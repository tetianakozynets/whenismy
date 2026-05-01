import { eventTypeIcon } from './event-icons'

it('returns trash emoji for garbage', () => {
  expect(eventTypeIcon('garbage')).toBe('🗑️')
})

it('returns recycle emoji for recycling', () => {
  expect(eventTypeIcon('recycling')).toBe('♻️')
})

it('returns leaf emoji for yard_waste', () => {
  expect(eventTypeIcon('yard_waste')).toBe('🌿')
})

it('returns box emoji for bulk_waste', () => {
  expect(eventTypeIcon('bulk_waste')).toBe('📦')
})

it('returns truck emoji for unknown types', () => {
  expect(eventTypeIcon('hazardous')).toBe('🚛')
})

it('returns truck emoji for organics (not in map)', () => {
  expect(eventTypeIcon('organics')).toBe('🚛')
})
