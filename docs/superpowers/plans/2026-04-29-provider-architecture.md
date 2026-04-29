# Provider Architecture & Free Data Sources — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Recollect commercial-API dependency with a free provider system: NYC addresses use the DSNY open data API (free, covers all 5 boroughs), and any Recollect-covered city worldwide works via user-pasted calendar URL (free iCal endpoint, no key needed).

**Architecture:** `lookup-schedule` becomes a dispatcher: NYC addresses go through GeoSearch geocoder → DSNY zone lookup → schedule generation; a new `ical_url` body param triggers Recollect iCal parsing instead of address search. The `place_lookup_cache` and `user_preferences` tables gain a `provider` column so each user's data source is tracked. The Expo app gains a "Paste your calendar URL" screen reachable from the address-not-found screen.

**Tech Stack:** Supabase Edge Functions (Deno), NYC GeoSearch API (free), NYC Open Data Socrata API (free), Recollect public iCal JSON endpoint (free), existing Expo app (React Native)

---

## Free APIs used — no key required

| API | Endpoint | What it does |
|---|---|---|
| NYC GeoSearch | `https://geosearch.planninglabs.nyc/v2/search?text={address}&size=1` | Geocodes NYC addresses → lat/lng + `locality_a:"NYC"` flag |
| NYC DSNY Open Data | `https://data.cityofnewyork.us/resource/rv63-53db.json?$where=intersects(multipolygon,'POINT({lng} {lat})')&$limit=1` | Returns collection zone + days for any NYC lat/lng |
| Recollect iCal events | `https://api.recollect.net/api/places/{PLACE_ID}/services/{SERVICE_ID}/events?after=X&before=Y` | Returns pickup events JSON, no auth needed |

---

## File map

| File | Action | Purpose |
|---|---|---|
| `supabase/migrations/20260429000006_providers.sql` | Create | Add `provider` + `provider_data` to cache; `provider` + `ical_url` to prefs |
| `supabase/functions/_shared/nyc-dsny.ts` | Create | geocodeNYC, lookupDSNYZone, parseDSNYDays, generateDSNYEvents |
| `supabase/functions/_shared/nyc-dsny.test.ts` | Create | Unit tests for DSNY utilities |
| `supabase/functions/_shared/recollect.ts` | Modify | Add parseIcalUrl(), getEventsForPlace() using public JSON endpoint |
| `supabase/functions/lookup-schedule/index.ts` | Modify | Dispatcher: NYC → DSNY, ical_url → iCal, else → not-found |
| `supabase/functions/lookup-schedule/index.test.ts` | Modify | Update tests for new dispatch logic |
| `supabase/functions/refresh-schedules/index.ts` | Modify | Handle provider='recollect-ical' re-fetch; 'nyc-dsny' regenerate |
| `supabase/tests/schema.test.sql` | Modify | Add assertions for new columns |
| `src/lib/types.ts` | Modify | Add `provider` field to `PlaceInfo`; add `LookupByUrlResponse` |
| `src/lib/api.ts` | Modify | Add `lookupByCalendarUrl(url)` function + test |
| `app/calendar-url.tsx` | Create | "Paste your calendar URL" screen |
| `app/address-not-found.tsx` | Modify | Add "Paste your calendar URL" button |
| `app/_layout.tsx` | Modify | Register `calendar-url` screen |

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260429000006_providers.sql`
- Modify: `supabase/tests/schema.test.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260429000006_providers.sql`:

```sql
-- place_lookup_cache: track which provider served this result
alter table public.place_lookup_cache
  add column if not exists provider        text not null default 'recollect',
  add column if not exists provider_data   jsonb;

-- user_preferences: track provider + store iCal URL for recollect-ical users
alter table public.user_preferences
  add column if not exists provider  text,
  add column if not exists ical_url  text;

-- check constraints to prevent invalid provider values
alter table public.place_lookup_cache
  add constraint cache_provider_check
  check (provider in ('recollect', 'nyc-dsny', 'recollect-ical'));

alter table public.user_preferences
  add constraint prefs_provider_check
  check (provider in ('recollect', 'nyc-dsny', 'recollect-ical', 'manual') or provider is null);

-- extend pickup_events source to accept 'nyc-dsny'
alter table public.pickup_events
  drop constraint if exists pickup_events_source_check;
alter table public.pickup_events
  add constraint pickup_events_source_check
  check (source in ('recollect', 'manual', 'nyc-dsny'));
```

- [ ] **Step 2: Apply migration and run existing tests**

```bash
cd /Users/tatianakozynets/repos/whenIsMy && npx supabase db reset
```

Expected: resets and applies all 6 migrations without errors.

```bash
npx supabase test db
```

Expected: all existing tests pass (the new columns have defaults so nothing breaks).

- [ ] **Step 3: Add schema assertions to `supabase/tests/schema.test.sql`**

Open `supabase/tests/schema.test.sql`. Change `select plan(22)` to `select plan(26)`.

Add these 4 assertions before the `select * from finish()` line:

```sql
select has_column('public', 'place_lookup_cache', 'provider',      'place_lookup_cache.provider');
select has_column('public', 'place_lookup_cache', 'provider_data', 'place_lookup_cache.provider_data');
select has_column('public', 'user_preferences',   'provider',      'user_preferences.provider');
select has_column('public', 'user_preferences',   'ical_url',      'user_preferences.ical_url');
```

- [ ] **Step 4: Run schema tests to confirm 26 pass**

```bash
npx supabase test db
```

Expected: 26 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260429000006_providers.sql supabase/tests/schema.test.sql
git commit -m "feat: add provider + ical_url columns for multi-source schedule architecture"
```

---

## Task 2: NYC DSNY shared utility

**Files:**
- Create: `supabase/functions/_shared/nyc-dsny.ts`
- Create: `supabase/functions/_shared/nyc-dsny.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `supabase/functions/_shared/nyc-dsny.test.ts`:

```typescript
import {
  isNYCAddress,
  parseDSNYDays,
  generateDSNYEvents,
  type DSNYZone,
} from './nyc-dsny.ts'

// ── isNYCAddress ────────────────────────────────────────────────────────────
Deno.test('isNYCAddress: recognises NYC borough names', () => {
  for (const city of ['New York', 'Brooklyn', 'Manhattan', 'Bronx', 'Queens', 'Staten Island']) {
    if (!isNYCAddress(city, 'NY')) {
      throw new Error(`Expected ${city} NY to be NYC`)
    }
  }
})

Deno.test('isNYCAddress: rejects non-NYC NY cities', () => {
  if (isNYCAddress('Buffalo', 'NY')) throw new Error('Buffalo NY should not be NYC')
  if (isNYCAddress('Albany', 'NY')) throw new Error('Albany NY should not be NYC')
  if (isNYCAddress('New York', 'NJ')) throw new Error('New York NJ should not be NYC')
})

// ── parseDSNYDays ────────────────────────────────────────────────────────────
Deno.test('parseDSNYDays: parses single day', () => {
  const result = parseDSNYDays('Mon')
  if (result.length !== 1 || result[0] !== 'monday') {
    throw new Error(`Expected ['monday'], got ${JSON.stringify(result)}`)
  }
})

Deno.test('parseDSNYDays: parses multiple days', () => {
  const result = parseDSNYDays('Mon, Thu')
  if (result.length !== 2 || !result.includes('monday') || !result.includes('thursday')) {
    throw new Error(`Wrong result: ${JSON.stringify(result)}`)
  }
})

Deno.test('parseDSNYDays: parses three days', () => {
  const result = parseDSNYDays('Mon, Wed, Fri')
  if (result.length !== 3) throw new Error(`Expected 3 days, got ${result.length}`)
})

Deno.test('parseDSNYDays: returns empty array for empty/null input', () => {
  if (parseDSNYDays('').length !== 0) throw new Error('Should be empty')
  if (parseDSNYDays(null as unknown as string).length !== 0) throw new Error('Should be empty for null')
})

// ── generateDSNYEvents ───────────────────────────────────────────────────────
Deno.test('generateDSNYEvents: generates refuse events for each listed day', () => {
  const zone: DSNYZone = {
    district: 'MN05',
    section: 'MN051',
    freq_refuse: 'Mon, Thu',
    freq_recycling: 'Mon',
    freq_organics: null,
    freq_bulk: 'Mon, Thu',
  }
  // Use a fixed Monday as start so results are deterministic
  const start = new Date('2026-04-27T00:00:00') // Monday
  const events = generateDSNYEvents(zone, 14, start)

  const garbage = events.filter(e => e.event_type === 'garbage')
  const recycling = events.filter(e => e.event_type === 'recycling')

  // 14 days = 2 Mondays + 2 Thursdays = 4 garbage events
  if (garbage.length !== 4) throw new Error(`Expected 4 garbage events, got ${garbage.length}`)
  // 2 Mondays = 2 recycling events
  if (recycling.length !== 2) throw new Error(`Expected 2 recycling events, got ${recycling.length}`)
})

Deno.test('generateDSNYEvents: omits organics when freq_organics is null', () => {
  const zone: DSNYZone = {
    district: 'BK01', section: 'BK011',
    freq_refuse: 'Wed, Sat', freq_recycling: 'Wed',
    freq_organics: null, freq_bulk: 'Sat',
  }
  const start = new Date('2026-04-29T00:00:00') // Wednesday
  const events = generateDSNYEvents(zone, 7, start)
  if (events.some(e => e.event_type === 'organics')) {
    throw new Error('Should not generate organics when freq_organics is null')
  }
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/tatianakozynets/repos/whenIsMy && deno test --allow-env --no-check supabase/functions/_shared/nyc-dsny.test.ts 2>&1 | tail -10
```

Expected: FAIL — Cannot resolve module `./nyc-dsny.ts`

- [ ] **Step 3: Create `supabase/functions/_shared/nyc-dsny.ts`**

```typescript
const NYC_CITIES = new Set([
  'new york', 'manhattan', 'brooklyn', 'bronx', 'queens', 'staten island',
  'flushing', 'jamaica', 'astoria', 'bayside', 'ridgewood', 'forest hills',
  'jackson heights', 'long island city', 'bay ridge', 'flatbush',
])

export function isNYCAddress(city: string, state: string): boolean {
  return state.toUpperCase() === 'NY' && NYC_CITIES.has(city.trim().toLowerCase())
}

// ── Geocoding ────────────────────────────────────────────────────────────────

export interface GeoPoint {
  lat: number
  lng: number
}

export async function geocodeNYC(
  street: string,
  city: string,
  state: string
): Promise<GeoPoint | null> {
  const q = encodeURIComponent(`${street}, ${city}, ${state}`)
  const res = await fetch(
    `https://geosearch.planninglabs.nyc/v2/search?text=${q}&size=1`
  )
  if (!res.ok) return null
  const data = await res.json()
  const feat = data?.features?.[0]
  if (!feat) return null
  const [lng, lat] = feat.geometry.coordinates
  return { lat, lng }
}

// ── DSNY Zone Lookup ─────────────────────────────────────────────────────────

export interface DSNYZone {
  district: string
  section: string
  freq_refuse: string
  freq_recycling: string
  freq_organics: string | null
  freq_bulk: string | null
}

export async function lookupDSNYZone(
  lat: number,
  lng: number
): Promise<DSNYZone | null> {
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

// ── Day Parsing ──────────────────────────────────────────────────────────────

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

// ── Event Generation ─────────────────────────────────────────────────────────

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

export interface DSNYEvent {
  event_date: string
  event_type: string
}

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
      while (d.getTime() <= endMs) {
        events.push({ event_date: localDateStr(d), event_type: eventType })
        d.setDate(d.getDate() + 7)
      }
    }
  }

  addEvents(zone.freq_refuse, 'garbage')
  addEvents(zone.freq_recycling, 'recycling')
  addEvents(zone.freq_organics, 'organics')

  events.sort((a, b) => a.event_date.localeCompare(b.event_date))
  return events
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/tatianakozynets/repos/whenIsMy && deno test --allow-env --no-check supabase/functions/_shared/nyc-dsny.test.ts 2>&1 | tail -15
```

Expected: all 7 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/nyc-dsny.ts supabase/functions/_shared/nyc-dsny.test.ts
git commit -m "feat: add NYC DSNY shared utility — geocode, zone lookup, event generation"
```

---

## Task 3: Recollect iCal URL parser

Add two functions to the existing `_shared/recollect.ts`:
- `parseIcalUrl(url)` — extracts Place ID + Service ID from an iCal/events URL
- `getEventsForPlace(placeId, serviceId, after, before)` — fetches schedule via the public JSON events endpoint (no API key)

**Files:**
- Modify: `supabase/functions/_shared/recollect.ts`

- [ ] **Step 1: Read the current recollect.ts**

```bash
cat /Users/tatianakozynets/repos/whenIsMy/supabase/functions/_shared/recollect.ts
```

Note: `getEvents(placeId, after, before)` already exists and uses the API key. We are adding a parallel version that hits the same endpoint but is called without the key (it returns 200 without auth).

- [ ] **Step 2: Add parseIcalUrl and getEventsForPlace to `recollect.ts`**

Append to the end of `supabase/functions/_shared/recollect.ts`:

```typescript
// ── iCal URL parsing (no API key required) ───────────────────────────────────

export interface IcalUrlParts {
  placeId: string
  serviceId: string
}

/**
 * Parses a Recollect iCal/events URL and extracts place ID + service ID.
 * Accepts both formats:
 *   https://recollect.a.ssl.fastly.net/api/places/{PLACE_ID}/services/{SERVICE_ID}/events.en-US.ics
 *   https://api.recollect.net/api/places/{PLACE_ID}/services/{SERVICE_ID}/events.en-US.ics
 */
export function parseIcalUrl(url: string): IcalUrlParts | null {
  const match = url.match(
    /\/places\/([0-9A-F-]{36})\/services\/(\d+)\//i
  )
  if (!match) return null
  return { placeId: match[1].toUpperCase(), serviceId: match[2] }
}

/**
 * Fetches pickup events for a known place ID + service ID using the public
 * JSON endpoint (no API key required).
 */
export async function getEventsForPlace(
  placeId: string,
  serviceId: string,
  after: string,
  before: string
): Promise<RecollectEvent[]> {
  const url = `https://api.recollect.net/api/places/${placeId}/services/${serviceId}/events` +
    `?after=${after}&before=${before}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Recollect place events failed: ${res.status}`)
  const data = await res.json()
  const rawEvents = Array.isArray(data) ? data : (data.events ?? [])

  // Each raw event has a `day` and `flags` array; flags carry the event type via `name`
  const result: RecollectEvent[] = []
  for (const ev of rawEvents) {
    for (const flag of ev.flags ?? []) {
      if (flag.event_type === 'pickup') {
        result.push({
          date: ev.day,
          event_type: normalizeEventType(flag.name ?? ''),
        })
      }
    }
  }
  return result
}
```

- [ ] **Step 3: Write a quick inline test**

Create `supabase/functions/_shared/recollect-ical.test.ts`:

```typescript
import { parseIcalUrl } from './recollect.ts'

Deno.test('parseIcalUrl: parses fastly URL', () => {
  const url = 'https://recollect.a.ssl.fastly.net/api/places/BCCDF30E-578B-11E4-AD38-5839C200407A/services/208/events.en.ics'
  const parts = parseIcalUrl(url)
  if (!parts) throw new Error('Expected non-null result')
  if (parts.placeId !== 'BCCDF30E-578B-11E4-AD38-5839C200407A') throw new Error(`Wrong placeId: ${parts.placeId}`)
  if (parts.serviceId !== '208') throw new Error(`Wrong serviceId: ${parts.serviceId}`)
})

Deno.test('parseIcalUrl: parses api.recollect.net URL', () => {
  const url = 'https://api.recollect.net/api/places/F2BCBBF2-ACC9-11E8-B4BD-CFDD30C1D4D8/services/761/events.en-US.ics'
  const parts = parseIcalUrl(url)
  if (!parts) throw new Error('Expected non-null result')
  if (parts.placeId !== 'F2BCBBF2-ACC9-11E8-B4BD-CFDD30C1D4D8') throw new Error(`Wrong placeId: ${parts.placeId}`)
  if (parts.serviceId !== '761') throw new Error(`Wrong serviceId: ${parts.serviceId}`)
})

Deno.test('parseIcalUrl: returns null for unrecognised URL', () => {
  const parts = parseIcalUrl('https://example.com/not-a-recollect-url')
  if (parts !== null) throw new Error('Expected null')
})

Deno.test('parseIcalUrl: strips client_id param without issue (URL contains it)', () => {
  const url = 'https://recollect.a.ssl.fastly.net/api/places/BCCDF30E-578B-11E4-AD38-5839C200407A/services/208/events.en.ics?client_id=6FBD18FE-167B-11EC-992A-C843A7F05606'
  const parts = parseIcalUrl(url)
  if (!parts) throw new Error('Expected non-null result even with client_id')
  if (parts.serviceId !== '208') throw new Error(`Wrong serviceId: ${parts.serviceId}`)
})
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/tatianakozynets/repos/whenIsMy && deno test --allow-env --no-check supabase/functions/_shared/recollect-ical.test.ts 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/recollect.ts supabase/functions/_shared/recollect-ical.test.ts
git commit -m "feat: add parseIcalUrl and getEventsForPlace to recollect shared utility"
```

---

## Task 4: Update `lookup-schedule` Edge Function

Refactor `lookup-schedule/index.ts` into a dispatcher that routes to the correct provider.

**Files:**
- Modify: `supabase/functions/lookup-schedule/index.ts`
- Modify: `supabase/functions/lookup-schedule/index.test.ts`

The function now accepts two body shapes:
- `{ street, city, state }` — address lookup (NYC → DSNY; else → not-found with url suggestion)
- `{ ical_url }` — iCal URL lookup (Recollect iCal, no key)

- [ ] **Step 1: Read the current index.ts and index.test.ts**

```bash
cat /Users/tatianakozynets/repos/whenIsMy/supabase/functions/lookup-schedule/index.ts
cat /Users/tatianakozynets/repos/whenIsMy/supabase/functions/lookup-schedule/index.test.ts
```

- [ ] **Step 2: Replace `supabase/functions/lookup-schedule/index.ts`**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { checkRateLimit } from '../_shared/rate-limit.ts'
import { timezoneFromLatLng } from '../_shared/tz.ts'
import {
  isNYCAddress, geocodeNYC, lookupDSNYZone, generateDSNYEvents,
} from '../_shared/nyc-dsny.ts'
import {
  parseIcalUrl, getEventsForPlace, normalizeEventType,
} from '../_shared/recollect.ts'

export function normalizeAddress(street: string, city: string, state: string): string {
  return [street, city, state].map(s => s.trim().toLowerCase()).join('|')
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders() })

  let body: {
    street?: string; city?: string; state?: string; ical_url?: string
  }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  // ── Validate ──────────────────────────────────────────────────────────────
  const { street, city, state, ical_url } = body
  if (!ical_url && (!street || !city || !state)) {
    return json({ error: 'Provide either (street + city + state) or ical_url' }, 400)
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown'
  const { allowed, retryAfter } = await checkRateLimit(supabase, {
    key: `lookup:${ip}`, maxPerMinute: 10, maxPerDay: 100,
  })
  if (!allowed) {
    return json({ error: 'Rate limit exceeded' }, 429, { 'Retry-After': String(retryAfter) })
  }

  const after = new Date().toISOString().slice(0, 10)
  const before = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // ── iCal URL path ─────────────────────────────────────────────────────────
  if (ical_url) {
    const parts = parseIcalUrl(ical_url)
    if (!parts) return json({ error: 'Invalid Recollect calendar URL' }, 400)

    const addressKey = `ical:${parts.placeId}:${parts.serviceId}`
    const { data: cached } = await supabase
      .from('place_lookup_cache')
      .select('*')
      .eq('address_key', addressKey)
      .single()

    if (cached) {
      const rawEvents = await getEventsForPlace(parts.placeId, parts.serviceId, after, before)
      return json({ place: { ...cached }, events: rawEvents })
    }

    let rawEvents: Awaited<ReturnType<typeof getEventsForPlace>>
    try {
      rawEvents = await getEventsForPlace(parts.placeId, parts.serviceId, after, before)
    } catch (err) {
      console.error('iCal fetch error', err)
      return json({ error: 'Could not fetch schedule from calendar URL' }, 502)
    }

    const supportedTypes = [...new Set(rawEvents.map(e => e.event_type))]
    const cacheRow = {
      address_key: addressKey,
      recollect_place_id: parts.placeId,
      latitude: null,
      longitude: null,
      timezone: null,
      supported_event_types: supportedTypes,
      provider: 'recollect-ical',
      provider_data: { place_id: parts.placeId, service_id: parts.serviceId, ical_url },
    }
    await supabase.from('place_lookup_cache').upsert(cacheRow)
    return json({ place: cacheRow, events: rawEvents })
  }

  // ── Address path ──────────────────────────────────────────────────────────
  const addressKey = normalizeAddress(street!, city!, state!)

  const { data: cached } = await supabase
    .from('place_lookup_cache')
    .select('*')
    .eq('address_key', addressKey)
    .single()

  if (cached) {
    const events = await eventsFromCache(cached, after, before)
    return json({ place: cached, events })
  }

  // ── NYC DSNY ──────────────────────────────────────────────────────────────
  if (isNYCAddress(city!, state!)) {
    const coords = await geocodeNYC(street!, city!, state!)
    if (!coords) return json({ error: 'Address not found', notFound: true, suggestUrl: false }, 404)

    const zone = await lookupDSNYZone(coords.lat, coords.lng)
    if (!zone) return json({ error: 'Address not found in NYC schedule zones', notFound: true, suggestUrl: false }, 404)

    const timezone = timezoneFromLatLng(coords.lat, coords.lng)
    const supportedTypes = ['garbage', 'recycling']
    if (zone.freq_organics) supportedTypes.push('organics')

    const cacheRow = {
      address_key: addressKey,
      recollect_place_id: null,
      latitude: coords.lat,
      longitude: coords.lng,
      timezone,
      supported_event_types: supportedTypes,
      provider: 'nyc-dsny',
      provider_data: zone,
    }
    await supabase.from('place_lookup_cache').upsert(cacheRow)

    const events = generateDSNYEvents(zone, 60).map(e => ({
      date: e.event_date,
      event_type: e.event_type,
    }))
    return json({ place: cacheRow, events })
  }

  // ── Not covered — suggest pasting calendar URL ────────────────────────────
  return json({
    error: 'Address not found',
    notFound: true,
    suggestUrl: true,
  }, 404)
}

async function eventsFromCache(
  cached: Record<string, unknown>,
  after: string,
  before: string
) {
  if (cached.provider === 'nyc-dsny') {
    const zone = cached.provider_data as Parameters<typeof generateDSNYEvents>[0]
    return generateDSNYEvents(zone, 60).map(e => ({
      date: e.event_date,
      event_type: e.event_type,
    }))
  }
  if (cached.provider === 'recollect-ical' || cached.provider === 'recollect') {
    const pd = cached.provider_data as { place_id: string; service_id: string } | null
    if (pd?.place_id && pd?.service_id) {
      return getEventsForPlace(pd.place_id, pd.service_id, after, before)
    }
  }
  return []
}

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(), ...extra },
  })
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

if (import.meta.main) Deno.serve(handler)
```

- [ ] **Step 3: Update `supabase/functions/lookup-schedule/index.test.ts`**

Read the current test file, then update it to test the new dispatch logic.

Replace the full content with:

```typescript
import { normalizeAddress } from './index.ts'
import { isNYCAddress, parseDSNYDays, generateDSNYEvents } from '../_shared/nyc-dsny.ts'
import { parseIcalUrl } from '../_shared/recollect.ts'

// ── normalizeAddress ─────────────────────────────────────────────────────────
Deno.test('normalizeAddress: trims and lowercases', () => {
  const result = normalizeAddress(' 123 Main St ', 'New York', 'NY')
  if (result !== '123 main st|new york|ny') {
    throw new Error(`Wrong result: ${result}`)
  }
})

// ── isNYCAddress ─────────────────────────────────────────────────────────────
Deno.test('isNYCAddress: Brooklyn NY is NYC', () => {
  if (!isNYCAddress('Brooklyn', 'NY')) throw new Error('Expected true')
})

Deno.test('isNYCAddress: Buffalo NY is not NYC', () => {
  if (isNYCAddress('Buffalo', 'NY')) throw new Error('Expected false')
})

// ── parseDSNYDays ─────────────────────────────────────────────────────────────
Deno.test('parseDSNYDays: Mon, Thu returns 2 days', () => {
  const days = parseDSNYDays('Mon, Thu')
  if (days.length !== 2) throw new Error(`Expected 2 days, got ${days.length}`)
})

// ── generateDSNYEvents ────────────────────────────────────────────────────────
Deno.test('generateDSNYEvents: events are sorted by date', () => {
  const zone = { district: 'MN05', section: 'MN051', freq_refuse: 'Mon, Thu', freq_recycling: 'Mon', freq_organics: null, freq_bulk: null }
  const events = generateDSNYEvents(zone, 14, new Date('2026-04-27T00:00:00'))
  for (let i = 1; i < events.length; i++) {
    if (events[i].event_date < events[i - 1].event_date) {
      throw new Error('Events not sorted')
    }
  }
})

// ── parseIcalUrl ──────────────────────────────────────────────────────────────
Deno.test('parseIcalUrl: extracts IDs from iCal URL', () => {
  const parts = parseIcalUrl(
    'https://recollect.a.ssl.fastly.net/api/places/BCCDF30E-578B-11E4-AD38-5839C200407A/services/208/events.en.ics'
  )
  if (!parts || parts.serviceId !== '208') throw new Error('Failed to parse')
})
```

- [ ] **Step 4: Run Deno tests**

```bash
cd /Users/tatianakozynets/repos/whenIsMy && deno test --allow-env --no-check supabase/functions/lookup-schedule/index.test.ts 2>&1 | tail -15
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/lookup-schedule/index.ts supabase/functions/lookup-schedule/index.test.ts
git commit -m "feat: refactor lookup-schedule into provider dispatcher — NYC DSNY + Recollect iCal"
```

---

## Task 5: Update `refresh-schedules` Edge Function

**Files:**
- Modify: `supabase/functions/refresh-schedules/index.ts`

The refresh function currently only handles Recollect API users. It needs to also handle `recollect-ical` users (re-fetch their iCal URL) and `nyc-dsny` users (regenerate from cached zone — no HTTP call needed).

- [ ] **Step 1: Read the current refresh-schedules/index.ts**

```bash
cat /Users/tatianakozynets/repos/whenIsMy/supabase/functions/refresh-schedules/index.ts
```

- [ ] **Step 2: Update `getUsersForSlot` query to include ical_url + provider**

In `supabase/functions/refresh-schedules/index.ts`, change the `getUsersForSlot` select query from:

```typescript
.select('user_id, recollect_place_id, supported_event_types')
.not('recollect_place_id', 'is', null)
```

to:

```typescript
.select('user_id, recollect_place_id, supported_event_types, provider, ical_url')
.or('recollect_place_id.not.is.null,provider.eq.nyc-dsny,provider.eq.recollect-ical')
```

- [ ] **Step 3: Update the per-user refresh loop to handle all providers**

Replace the inner `try` block that calls `getEvents(user.recollect_place_id, ...)` with:

```typescript
    try {
      const after = new Date().toISOString().slice(0, 10)
      const before = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      let events: Array<{ date: string; event_type: string }> = []

      if (user.provider === 'nyc-dsny') {
        // NYC DSNY schedules are stable week-to-week (they change annually).
        // Events are regenerated on-demand by lookup-schedule using the cached
        // provider_data. No re-fetch needed here.
        refreshed++
        continue
      } else if (user.provider === 'recollect-ical' && user.ical_url) {
        const parts = parseIcalUrl(user.ical_url)
        if (!parts) { errors++; continue }
        const rawEvents = await getEventsForPlace(parts.placeId, parts.serviceId, after, before)
        events = rawEvents.map(e => ({ date: e.date, event_type: e.event_type }))
      } else if (user.recollect_place_id) {
        // Original Recollect API path (requires RECOLLECT_API_KEY)
        const rawEvents = await getEvents(user.recollect_place_id, after, before)
        events = rawEvents.map(e => ({
          date: e.date,
          event_type: normalizeEventType(e.event_type),
        }))
      } else {
        refreshed++
        continue
      }

      const source = user.provider === 'nyc-dsny' ? 'nyc-dsny' : 'recollect'
      const rows = events.map(e => ({
        user_id: user.user_id,
        event_date: e.date,
        event_type: e.event_type,
        source,
        refreshed_at: new Date().toISOString(),
      }))

      await supabase
        .from('pickup_events')
        .delete()
        .eq('user_id', user.user_id)
        .eq('source', source)
        .lt('event_date', after)

      if (rows.length > 0) {
        await supabase
          .from('pickup_events')
          .upsert(rows, { onConflict: 'user_id,event_date,event_type,source' })
      }

      refreshed++
    } catch (err) {
      console.error(`Failed to refresh for user ${user.user_id}:`, err)
      errors++
    }
```

Also add the new import at the top of the file:

```typescript
import { parseIcalUrl, getEventsForPlace } from '../_shared/recollect.ts'
```

- [ ] **Step 4: Run pgTAP tests to confirm nothing is broken**

```bash
npx supabase test db
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/refresh-schedules/index.ts
git commit -m "feat: update refresh-schedules to handle recollect-ical and nyc-dsny providers"
```

---

## Task 6: Update Expo app — types, API client, new screen

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/api.ts`
- Modify: `src/lib/api.test.ts`
- Create: `app/calendar-url.tsx`

- [ ] **Step 1: Update `src/lib/types.ts`**

Add `provider` and `suggestUrl` to the existing types. Open the file and make these changes:

In `PlaceInfo`, add:
```typescript
  provider: 'nyc-dsny' | 'recollect-ical' | 'recollect' | null
  ical_url?: string
```

In `LookupError`, add:
```typescript
  suggestUrl?: boolean
```

The updated interfaces:

```typescript
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
  date: string
  event_type: string
}

export interface PlaceMatch {
  id: string
  name: string
  locality: string
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
  suggestUrl?: boolean
}
```

- [ ] **Step 2: Add `lookupByCalendarUrl` to `src/lib/api.ts`**

Append to the end of `src/lib/api.ts`:

```typescript
export async function lookupByCalendarUrl(
  icalUrl: string
): Promise<LookupResponse | LookupError> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL
  try {
    const res = await fetch(`${base}/functions/v1/lookup-schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ical_url: icalUrl }),
    })
    return res.json()
  } catch {
    return { error: 'Network error — check your connection and try again.' }
  }
}
```

- [ ] **Step 3: Add test for `lookupByCalendarUrl` to `src/lib/api.test.ts`**

Add this describe block to the existing test file:

```typescript
describe('lookupByCalendarUrl', () => {
  it('posts ical_url to lookup-schedule', async () => {
    const mockResponse = {
      place: { address_key: 'ical:BCCDF30E:208', recollect_place_id: 'BCCDF30E', provider: 'recollect-ical', latitude: null, longitude: null, timezone: null, supported_event_types: ['garbage'] },
      events: [{ date: '2026-05-01', event_type: 'garbage' }],
    }
    ;(fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve(mockResponse) })
    const url = 'https://recollect.a.ssl.fastly.net/api/places/BCCDF30E-578B-11E4-AD38-5839C200407A/services/208/events.en.ics'
    const result = await lookupByCalendarUrl(url)
    expect(isError(result)).toBe(false)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/lookup-schedule'),
      expect.objectContaining({ body: JSON.stringify({ ical_url: url }) })
    )
  })
})
```

Also update the import at the top of `api.test.ts`:

```typescript
import { lookupSchedule, isError, lookupByCalendarUrl } from './api'
```

- [ ] **Step 4: Run Jest tests**

```bash
cd /Users/tatianakozynets/repos/whenIsMy && npx jest src/lib/api.test.ts --no-coverage 2>&1 | tail -10
```

Expected: 5/5 tests pass (4 original + 1 new).

- [ ] **Step 5: Create `app/calendar-url.tsx`**

```typescript
import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, SafeAreaView, ScrollView, Linking,
} from 'react-native'
import { router } from 'expo-router'
import { lookupByCalendarUrl, isError } from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'
import { colors, spacing, radius } from '../src/constants/theme'

const HELP_URL = 'https://support.recollect.net/hc/en-us/articles/360039222532'

export default function CalendarUrlScreen() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please paste your calendar URL.')
      return
    }
    if (!trimmed.includes('recollect') || !trimmed.includes('/places/')) {
      setError('This doesn\'t look like a Recollect calendar URL. It should contain "/places/".')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await lookupByCalendarUrl(trimmed)
      if (isError(result)) {
        setError(result.error)
        return
      }
      scheduleStore.set(result)
      router.push('/schedule')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backRow} accessibilityRole="button">
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Paste your calendar URL</Text>
        <Text style={styles.body}>
          1. Go to your city's waste schedule website and search for your address.{'\n'}
          2. Tap "Get a calendar" or "Subscribe to your schedule".{'\n'}
          3. Copy the URL that appears and paste it below.
        </Text>
        <Pressable
          onPress={() => Linking.openURL(HELP_URL)}
          accessibilityRole="link"
        >
          <Text style={styles.helpLink}>How to find your calendar URL →</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="https://recollect.a.ssl.fastly.net/api/places/..."
          value={url}
          onChangeText={setUrl}
          testID="input-calendar-url"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          multiline
        />
        {error ? <Text style={styles.error} testID="url-error">{error}</Text> : null}
        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          testID="url-submit"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>
            {loading ? 'Loading…' : 'Show my schedule'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  backRow: { paddingVertical: spacing.xs },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.textSecondary, lineHeight: 24 },
  helpLink: { color: colors.primary, fontSize: 14 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.md, fontSize: 14, backgroundColor: colors.card,
    minHeight: 80, textAlignVertical: 'top',
  },
  error: { color: colors.error, fontSize: 14 },
  button: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/api.ts src/lib/api.test.ts app/calendar-url.tsx
git commit -m "feat: add lookupByCalendarUrl API + CalendarUrl screen for Recollect iCal flow"
```

---

## Task 7: Wire up navigation and update existing screens

**Files:**
- Modify: `app/_layout.tsx` — register `calendar-url` screen
- Modify: `app/address-not-found.tsx` — add "Paste your calendar URL" button
- Modify: `app/index.tsx` — pass `suggestUrl` flag to address-not-found navigation
- Modify: `app/schedule.tsx` — show provider badge

- [ ] **Step 1: Update `app/_layout.tsx`**

Add `calendar-url` to the Stack screens:

```typescript
import { Stack } from 'expo-router'

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="address-not-found" />
      <Stack.Screen name="calendar-url" />
    </Stack>
  )
}
```

- [ ] **Step 2: Update `app/address-not-found.tsx`**

Replace the current content with:

```typescript
import React from 'react'
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, radius } from '../src/constants/theme'

export default function AddressNotFoundScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Address not found</Text>
        <Text style={styles.body}>
          We couldn't find an automatic schedule for your address. Your city may
          not be in our database yet.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/calendar-url')}
          accessibilityRole="button"
          testID="btn-paste-url"
        >
          <Text style={styles.primaryButtonText}>Paste your calendar URL</Text>
        </Pressable>
        <Text style={styles.orText}>or</Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          testID="btn-try-again"
        >
          <Text style={styles.secondaryButtonText}>Try a different address</Text>
        </Pressable>
        <Text style={styles.note}>
          Sign in to save your schedule and get pickup reminders.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  primaryButton: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  orText: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
  secondaryButton: {
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center',
  },
  secondaryButtonText: { color: colors.text, fontSize: 16 },
  note: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
})
```

- [ ] **Step 3: Update `app/schedule.tsx` — add provider badge**

In the `ScrollView` content, add a provider badge after the back link. Find the `<Pressable onPress={() => router.back()}>` section and add after it:

```typescript
{result.place.provider === 'nyc-dsny' && (
  <View style={styles.providerBadge}>
    <Text style={styles.providerText}>🗽 NYC official schedule</Text>
  </View>
)}
{result.place.provider === 'recollect-ical' && (
  <View style={styles.providerBadge}>
    <Text style={styles.providerText}>📅 Calendar subscription</Text>
  </View>
)}
```

Add to the StyleSheet:

```typescript
  providerBadge: {
    backgroundColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  providerText: { fontSize: 12, color: colors.textSecondary },
```

- [ ] **Step 4: Run full Jest test suite**

```bash
cd /Users/tatianakozynets/repos/whenIsMy && npx jest --no-coverage 2>&1 | tail -10
```

Expected: all 29 tests pass.

- [ ] **Step 5: Run all Deno unit tests**

```bash
cd /Users/tatianakozynets/repos/whenIsMy && deno test --allow-env --no-check supabase/functions/_shared/nyc-dsny.test.ts supabase/functions/_shared/recollect-ical.test.ts supabase/functions/lookup-schedule/index.test.ts 2>&1 | tail -15
```

Expected: 17 Deno tests pass (7 + 4 + 6).

- [ ] **Step 6: Run pgTAP tests**

```bash
npx supabase test db
```

Expected: 26 pgTAP tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/_layout.tsx app/address-not-found.tsx app/schedule.tsx
git commit -m "feat: wire provider badge, calendar-url screen, and updated not-found screen"
```

---

## End-to-end smoke test

### Test 1: NYC address (automatic, free)

With local Supabase + Edge Function running:
```bash
npx supabase start
npx supabase functions serve lookup-schedule --env-file .env.local
```

In the Expo app (`npx expo start --web`):
1. Enter a real NYC address (e.g. "120 Broadway", city "New York", state "NY")
2. Expect: Schedule screen with "🗽 NYC official schedule" badge and garbage/recycling days

### Test 2: Non-NYC address (URL paste flow)

1. Enter any non-NYC address
2. Expect: "Address not found" screen with two buttons
3. Tap "Paste your calendar URL"
4. Find your city's Recollect ICS URL (search `"[your city]" recollect waste schedule calendar`)
5. Paste it → expect: Schedule screen with "📅 Calendar subscription" badge

---

_CLAUDE.md plan table: update Plan 2.5 status to in-progress after starting._

_Next: Plan 3 — Auth, Notifications & Manual Entry (unchanged in scope, but `lookup-schedule` response now includes `provider` and `suggestUrl` which the auth flow can use)._
