import tzlookup from 'npm:tz-lookup@1.0.2'

export function timezoneFromLatLng(lat: number, lng: number): string {
  return tzlookup(lat, lng)
}
