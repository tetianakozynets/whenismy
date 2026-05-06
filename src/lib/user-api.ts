import { supabase } from './supabase'
import { PlaceInfo, PickupEvent, UserPreferences } from './types'

export async function saveAddress(
  userId: string,
  street: string,
  city: string,
  state: string,
  place: PlaceInfo
) {
  return supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      street,
      city,
      state,
      recollect_place_id: place.recollect_place_id,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
      supported_event_types: place.supported_event_types,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
}

export async function savePickupEvents(userId: string, events: PickupEvent[]) {
  const now = new Date().toISOString()
  return supabase.from('pickup_events').insert(
    events.map(e => ({
      user_id: userId,
      event_date: e.date,
      event_type: e.event_type,
      source: 'recollect',
      refreshed_at: now,
    }))
  )
}

export async function getPreferences(userId: string): Promise<UserPreferences | null> {
  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: {
    notification_time?: string
    notifications_garbage?: boolean
    notifications_recycling?: boolean
    notifications_yard_waste?: boolean
  }
) {
  return supabase
    .from('user_preferences')
    .update({ ...prefs, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
}

export async function deleteAccount() {
  return supabase.rpc('delete_user')
}

export async function getManualPickupEvents(userId: string): Promise<import('./types').PickupEvent[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('pickup_events')
    .select('event_date, event_type')
    .eq('user_id', userId)
    .eq('source', 'manual')
    .gte('event_date', today)
    .order('event_date')
    .limit(90)
  if (!data) return []
  return data.map(r => ({ date: r.event_date as string, event_type: r.event_type as string }))
}
