import tzlookup from 'npm:tz-lookup@6.1.25'

export function timezoneFromLatLng(lat: number, lng: number): string {
  return tzlookup(lat, lng)
}
