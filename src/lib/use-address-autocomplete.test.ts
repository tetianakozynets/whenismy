import { parseNominatimResult } from './use-address-autocomplete'

it('parses a full result with house number', () => {
  expect(parseNominatimResult({
    address: { house_number: '162', road: 'West 34th Street', city: 'New York', 'ISO3166-2-lvl4': 'US-NY' },
  })).toEqual({
    displayName: '162 West 34th Street, New York, NY',
    street: '162 West 34th Street',
    city: 'New York',
    state: 'NY',
  })
})

it('parses result without house number', () => {
  const result = parseNominatimResult({
    address: { road: 'Broadway', city: 'New York', 'ISO3166-2-lvl4': 'US-NY' },
  })
  expect(result?.street).toBe('Broadway')
})

it('falls back to town when city is absent', () => {
  const result = parseNominatimResult({
    address: { road: 'Main St', town: 'Smallville', 'ISO3166-2-lvl4': 'US-KS' },
  })
  expect(result?.city).toBe('Smallville')
})

it('falls back to village when city and town are absent', () => {
  const result = parseNominatimResult({
    address: { road: 'Elm St', village: 'Greenfield', 'ISO3166-2-lvl4': 'US-MA' },
  })
  expect(result?.city).toBe('Greenfield')
})

it('returns null when road is missing', () => {
  expect(parseNominatimResult({ address: { city: 'New York', 'ISO3166-2-lvl4': 'US-NY' } })).toBeNull()
})

it('returns null when city is missing', () => {
  expect(parseNominatimResult({ address: { road: 'Main St', 'ISO3166-2-lvl4': 'US-NY' } })).toBeNull()
})

it('returns null when state is missing', () => {
  expect(parseNominatimResult({ address: { road: 'Main St', city: 'Springfield' } })).toBeNull()
})
