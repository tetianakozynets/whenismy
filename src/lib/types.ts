export interface PlaceInfo {
  address_key: string
  recollect_place_id: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  supported_event_types: string[]
  provider: 'nyc-dsny' | 'recollect-ical' | 'recollect' | null
  ical_url?: string
}

export interface PickupEvent {
  date: string        // YYYY-MM-DD
  event_type: string  // 'garbage' | 'recycling' | 'yard_waste' | 'organics'
}

export interface PlaceMatch {
  id: string
  name: string        // formatted address from Recollect
  locality: string    // city/municipality
  lat: number
  lng: number
}

export interface LookupResponse {
  place: PlaceInfo
  events: PickupEvent[]
  multiple?: PlaceMatch[]
}

export interface LookupError {
  error: string
  notFound?: boolean    // address doesn't exist
  notCovered?: boolean  // address is real but app has no schedule for it
}

export interface UserPreferences {
  user_id: string
  street: string
  city: string
  state: string
  recollect_place_id: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  notification_time: string        // e.g. '20:00'
  notifications_garbage: boolean
  notifications_recycling: boolean
  notifications_yard_waste: boolean
  supported_event_types: string[]
}

export interface ManualScheduleInput {
  event_type: 'garbage' | 'recycling' | 'yard_waste'
  pickup_day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  frequency: 'weekly' | 'biweekly'
  anchor_date: string | null   // YYYY-MM-DD, required when frequency = 'biweekly'
}
