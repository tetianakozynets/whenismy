import AsyncStorage from '@react-native-async-storage/async-storage'
import { PlaceInfo, PickupEvent, ManualScheduleInput } from './types'

export const STORAGE_KEY = 'whenismy.savedAddress'
// Matches the 24h cache window the lookup-schedule Edge Function already uses.
export const SAVED_ADDRESS_STALE_MS = 24 * 60 * 60 * 1000

export interface SavedAddress {
  street: string
  city: string
  state: string
  place: PlaceInfo
  events: PickupEvent[]
  manualSchedules?: ManualScheduleInput[]
  savedAt: string
}

export type SaveAddressInput = Omit<SavedAddress, 'savedAt'>

export async function getSavedAddress(): Promise<SavedAddress | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SavedAddress
  } catch {
    return null
  }
}

export async function saveAddressLocally(input: SaveAddressInput): Promise<void> {
  const record: SavedAddress = { ...input, savedAt: new Date().toISOString() }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record))
}

export async function clearSavedAddress(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}

export function isStale(savedAt: string): boolean {
  return Date.now() - new Date(savedAt).getTime() > SAVED_ADDRESS_STALE_MS
}
