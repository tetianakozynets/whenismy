const NYC_CITIES = new Set([
  // Official borough names + aliases
  'new york', 'new york city', 'nyc', 'manhattan', 'brooklyn', 'bronx', 'queens', 'staten island',
  // Manhattan neighborhoods
  'harlem', 'east harlem', 'washington heights', 'inwood', 'upper west side',
  'upper east side', 'midtown', 'chelsea', 'tribeca', 'soho', 'noho', 'nolita',
  'greenwich village', 'east village', 'lower east side', 'financial district',
  'battery park city', 'two bridges', 'chinatown', 'little italy', 'hell\'s kitchen',
  'murray hill', 'gramercy', 'flatiron', 'morningside heights', 'hamilton heights',
  // Brooklyn neighborhoods
  'williamsburg', 'bushwick', 'park slope', 'crown heights', 'bedford-stuyvesant',
  'bed-stuy', 'sunset park', 'bensonhurst', 'sheepshead bay', 'canarsie',
  'east new york', 'brownsville', 'flatbush', 'flatlands', 'borough park',
  'bay ridge', 'red hook', 'dumbo', 'cobble hill', 'carroll gardens',
  'boerum hill', 'fort greene', 'clinton hill', 'prospect heights', 'greenpoint',
  'brighton beach', 'coney island', 'dyker heights', 'bath beach',
  // Queens neighborhoods
  'flushing', 'jamaica', 'astoria', 'bayside', 'ridgewood', 'forest hills',
  'jackson heights', 'long island city', 'woodside', 'elmhurst', 'sunnyside',
  'maspeth', 'corona', 'rego park', 'kew gardens', 'briarwood', 'fresh meadows',
  'hollis', 'st. albans', 'saint albans', 'richmond hill', 'ozone park',
  'south ozone park', 'woodhaven', 'howard beach', 'rosedale',
  'springfield gardens', 'cambria heights', 'far rockaway', 'rockaway',
  // Bronx neighborhoods
  'riverdale', 'fordham', 'tremont', 'mott haven', 'south bronx', 'hunts point',
  'highbridge', 'concourse', 'belmont', 'morris park', 'pelham bay',
  'throggs neck', 'city island', 'wakefield', 'williamsbridge',
  // Staten Island neighborhoods
  'richmond', 'st george', 'saint george', 'new dorp', 'tottenville',
  'stapleton', 'port richmond', 'west brighton', 'great kills',
])

export function isNYCAddress(city: string, state: string): boolean {
  return state.toUpperCase() === 'NY' && NYC_CITIES.has(city.trim().toLowerCase())
}

export interface GeoPoint { lat: number; lng: number }

export async function geocodeNYC(street: string, city: string, state: string): Promise<GeoPoint | null> {
  const q = encodeURIComponent(`${street}, ${city}, ${state}`)
  const res = await fetch(`https://geosearch.planninglabs.nyc/v2/search?text=${q}&size=1`)
  if (!res.ok) return null
  const data = await res.json()
  const feat = data?.features?.[0]
  // Require a result with a house number — nycpad returns layer="venue" (not "address"),
  // so checking housenumber is more robust than checking layer value
  if (!feat || !feat.properties?.housenumber) return null
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
  daysAhead = 60,
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
