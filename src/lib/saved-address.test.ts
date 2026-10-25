import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getSavedAddress, saveAddressLocally, clearSavedAddress, isStale,
  SAVED_ADDRESS_STALE_MS, STORAGE_KEY,
} from './saved-address'
import { PlaceInfo, PickupEvent, ManualScheduleInput } from './types'

const place: PlaceInfo = {
  address_key: '1 main st|mahwah|nj',
  recollect_place_id: 'p1',
  latitude: 40.9,
  longitude: -74.1,
  timezone: 'America/New_York',
  supported_event_types: ['garbage'],
  provider: 'recollect',
}

const events: PickupEvent[] = [{ date: '2026-06-01', event_type: 'garbage' }]

beforeEach(async () => {
  await AsyncStorage.clear()
})

it('returns null when nothing is saved', async () => {
  expect(await getSavedAddress()).toBeNull()
})

it('saves and retrieves an address', async () => {
  await saveAddressLocally({ street: '1 Main St', city: 'Mahwah', state: 'NJ', place, events })
  const saved = await getSavedAddress()
  expect(saved?.street).toBe('1 Main St')
  expect(saved?.city).toBe('Mahwah')
  expect(saved?.state).toBe('NJ')
  expect(saved?.place).toEqual(place)
  expect(saved?.events).toEqual(events)
  expect(typeof saved?.savedAt).toBe('string')
})

it('clears the saved address', async () => {
  await saveAddressLocally({ street: '1 Main St', city: 'Mahwah', state: 'NJ', place, events })
  await clearSavedAddress()
  expect(await getSavedAddress()).toBeNull()
})

it('returns null when stored JSON is corrupted', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, 'not json')
  expect(await getSavedAddress()).toBeNull()
})

it('returns null when a stored record is missing required string fields', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ street: 'x', events: [] })) // missing city/state
  expect(await getSavedAddress()).toBeNull()
})

it('round-trips manualSchedules when present', async () => {
  const manualSchedules: ManualScheduleInput[] = [
    { event_type: 'garbage', pickup_day: 'monday', frequency: 'weekly', anchor_date: null },
  ]
  await saveAddressLocally({ street: 'manual', city: '', state: '', place, events, manualSchedules })
  const saved = await getSavedAddress()
  expect(saved?.manualSchedules).toEqual(manualSchedules)
})

it('isStale returns false for a timestamp saved just now', () => {
  expect(isStale(new Date().toISOString())).toBe(false)
})

it('isStale returns true for a timestamp older than the stale window', () => {
  const old = new Date(Date.now() - SAVED_ADDRESS_STALE_MS - 1000).toISOString()
  expect(isStale(old)).toBe(true)
})
