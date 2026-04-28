export interface PlaceInfo {
  address_key: string
  recollect_place_id: string
  latitude: number
  longitude: number
  timezone: string
  supported_event_types: string[]
}

export interface PickupEvent {
  date: string        // YYYY-MM-DD
  event_type: string  // 'garbage' | 'recycling' | 'yard_waste'
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
  notFound?: boolean
}
