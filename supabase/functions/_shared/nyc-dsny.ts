export interface GeoPoint { lat: number; lng: number }

// NYC borough names the user might type → GeoClient borough parameter
const GEOCLIENT_BOROUGH: Record<string, string> = {
  manhattan: 'MANHATTAN',
  'new york': 'MANHATTAN',
  brooklyn: 'BROOKLYN',
  queens: 'QUEENS',
  bronx: 'BRONX',
  'the bronx': 'BRONX',
  'staten island': 'STATEN ISLAND',
}

// Expand common USPS abbreviations that Geosupport may not recognise
function expandStreetAbbrev(s: string): string {
  return s
    .replace(/\bSt\b/gi, 'Street')
    .replace(/\bAve\b/gi, 'Avenue')
    .replace(/\bBlvd\b/gi, 'Boulevard')
    .replace(/\bDr\b/gi, 'Drive')
    .replace(/\bPl\b/gi, 'Place')
    .replace(/\bRd\b/gi, 'Road')
    .replace(/\bLn\b/gi, 'Lane')
    .replace(/\bCt\b/gi, 'Court')
    .replace(/\bPkwy\b/gi, 'Parkway')
    .replace(/\bExpy\b/gi, 'Expressway')
}

async function geocodeViaGeoClient(street: string, city: string): Promise<GeoPoint | null> {
  const key = Deno.env.get('NYC_GEOCLIENT_KEY')
  if (!key) return null

  const borough = GEOCLIENT_BOROUGH[city.trim().toLowerCase()]
  if (!borough) return null

  // Split "432 Fulton St" → houseNumber="432", streetName="Fulton St"
  const m = street.trim().match(/^([\w-]+)\s+(.+)$/)
  if (!m) return null
  const [, houseNumber, streetName] = m

  const call = async (sn: string): Promise<GeoPoint | null> => {
    const params = new URLSearchParams({ houseNumber, street: sn, borough, 'subscription-key': key })
    const res = await fetch(`https://api.nyc.gov/geoclient/v2/address?${params}`)
    if (!res.ok) return null
    const a = (await res.json())?.address
    if (!a || a.returnCode1a !== '00') return null
    const lat = parseFloat(a.latitude)
    const lng = parseFloat(a.longitude)
    if (isNaN(lat) || isNaN(lng)) return null
    return { lat, lng }
  }

  // Try as-is first; if street not found (code 11) retry with expanded abbreviations
  return (await call(streetName)) ?? (await call(expandStreetAbbrev(streetName)))
}

export async function geocodeNYC(street: string, city: string, state: string): Promise<GeoPoint | null> {
  // GeoClient (Geosupport) is the authoritative NYC geocoder — same as DSNY website.
  // Try with the city the user entered first.
  const gc = await geocodeViaGeoClient(street, city)
  if (gc) return gc

  // planninglabs geosearch: handles any city string (including "New York City", "NYC",
  // neighbourhood names like "Flushing") and returns the actual borough in the label.
  const q = encodeURIComponent(`${street}, ${city}, ${state}`)
  const res = await fetch(`https://geosearch.planninglabs.nyc/v2/search?text=${q}&size=1`)
  if (!res.ok) return null
  const data = await res.json()
  const feat = data?.features?.[0]
  if (!feat || !feat.properties?.housenumber) return null

  // If planninglabs resolved the borough, retry GeoClient with that borough so we
  // get authoritative coordinates instead of the (sometimes-inaccurate) venue point.
  const plBorough = (feat.properties?.borough ?? feat.properties?.locality ?? '') as string
  if (plBorough) {
    const gc2 = await geocodeViaGeoClient(street, plBorough)
    if (gc2) return gc2
  }

  // Last resort: use planninglabs coordinates directly
  const [lng, lat] = feat.geometry.coordinates
  return { lat, lng }
}

export interface DSNYZone {
  district: string
  section: string
  freq_refuse: string
  freq_recycling: string
  freq_organics: string | null
  freq_bulk: string | null
}

export async function lookupDSNYZone(lat: number, lng: number): Promise<DSNYZone | null> {
  const point = encodeURIComponent(`POINT(${lng} ${lat})`)
  const url = `https://data.cityofnewyork.us/resource/rv63-53db.json` +
    `?$where=intersects(multipolygon,'${point}')&$limit=1` +
    `&$select=district,section,freq_refuse,freq_recycling,freq_organics,freq_bulk`
  const res = await fetch(url)
  if (!res.ok) return null
  const rows = await res.json()
  if (!Array.isArray(rows) || rows.length === 0) return null
  const r = rows[0]
  return {
    district: r.district ?? '',
    section: r.section ?? '',
    freq_refuse: r.freq_refuse ?? '',
    freq_recycling: r.freq_recycling ?? '',
    freq_organics: r.freq_organics ?? null,
    freq_bulk: r.freq_bulk ?? null,
  }
}

const DAY_MAP: Record<string, string> = {
  mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday',
  fri: 'friday', sat: 'saturday', sun: 'sunday',
}

export function parseDSNYDays(freqStr: string): string[] {
  if (!freqStr) return []
  return freqStr
    .split(',')
    .map(s => s.trim().toLowerCase().slice(0, 3))
    .map(abbr => DAY_MAP[abbr])
    .filter(Boolean) as string[]
}

const DOW_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function localDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function nextOccurrence(targetDow: number, from: Date): Date {
  const diff = (targetDow - from.getDay() + 7) % 7
  const d = new Date(from)
  d.setDate(d.getDate() + diff)
  return d
}

export interface DSNYEvent { event_date: string; event_type: string }

export function generateDSNYEvents(
  zone: DSNYZone,
  daysAhead = 90,
  startDate: Date = new Date()
): DSNYEvent[] {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const endMs = start.getTime() + daysAhead * 86_400_000
  const events: DSNYEvent[] = []

  function addEvents(freqStr: string | null, eventType: string) {
    if (!freqStr) return
    for (const day of parseDSNYDays(freqStr)) {
      const dow = DOW_INDEX[day]
      const d = nextOccurrence(dow, start)
      while (d.getTime() < endMs) {
        events.push({ event_date: localDateStr(d), event_type: eventType })
        d.setDate(d.getDate() + 7)
      }
    }
  }

  addEvents(zone.freq_refuse, 'garbage')
  addEvents(zone.freq_recycling, 'recycling')
  addEvents(zone.freq_organics, 'organics')
  addEvents(zone.freq_bulk, 'bulk_waste')
  events.sort((a, b) => a.event_date.localeCompare(b.event_date))
  return events
}
