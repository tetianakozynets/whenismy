import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEvents, normalizeEventType, parseIcalUrl, getEventsForPlace } from '../_shared/recollect.ts'
import { normalizeAddress } from '../_shared/address.ts'
import { generateHobokenEvents } from '../_shared/hoboken.ts'
import { eventsFromProviderData as jerseyCityEvents } from '../_shared/jersey-city.ts'
import { rcCityAndZonesFromProviderData, getEventsFromRCZone } from '../_shared/recyclecoach.ts'

interface UserPreferenceRow {
  user_id: string
  recollect_place_id: string | null
  supported_event_types: string[] | null
  provider: string | null
  ical_url: string | null
  street: string
  city: string
  state: string
}

const REFRESHABLE_PROVIDERS = ['nyc-dsny', 'recollect-ical', 'hoboken-static', 'jersey-city', 'recyclecoach']

export function usersForSlotFilter(): string {
  return [
    'recollect_place_id.not.is.null',
    ...REFRESHABLE_PROVIDERS.map(p => `provider.eq.${p}`),
  ].join(',')
}

// 336 slots = 30-min slots per week (7 days × 48 slots/day)
export function slotForUser(userId: string): number {
  let hash = 0
  for (const c of userId.replace(/-/g, '')) {
    hash = (hash * 31 + c.charCodeAt(0)) & 0x7fffffff
  }
  return hash % 336
}

function currentSlot(): number {
  const now = new Date()
  const dayOfWeek = now.getUTCDay()
  const adjustedDay = (dayOfWeek + 6) % 7  // 0 = Monday
  const minutesSinceMonday = adjustedDay * 24 * 60 + now.getUTCHours() * 60 + now.getUTCMinutes()
  return Math.floor(minutesSinceMonday / 30)
}

// deno-lint-ignore no-explicit-any
export async function getUsersForSlot(
  supabase: ReturnType<typeof createClient<any>>,
  slot: number
): Promise<UserPreferenceRow[]> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('user_id, recollect_place_id, supported_event_types, provider, ical_url, street, city, state')
    .or(usersForSlotFilter())

  if (error) throw error
  const rows = (data ?? []) as UserPreferenceRow[]
  return rows.filter(u => slotForUser(u.user_id) === slot)
}

async function handler(_req: Request): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), { status: 500 })
  }

  const supabase = createClient(url, key)
  const slot = currentSlot()

  let users: UserPreferenceRow[]
  try {
    users = await getUsersForSlot(supabase, slot)
  } catch (err) {
    console.error('Failed to fetch users for slot', err)
    return new Response(JSON.stringify({ error: 'Failed to fetch users', slot }), { status: 500 })
  }

  let refreshed = 0
  let errors = 0

  for (const user of users) {
    try {
      const after = new Date().toISOString().slice(0, 10)
      const before = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

      if (user.provider === 'nyc-dsny') {
        // NYC DSNY schedules are stable week-to-week (they change annually).
        // Events are regenerated on-demand by lookup-schedule. No re-fetch needed.
        refreshed++
        continue
      }

      let events: Array<{ date: string; event_type: string }> = []
      const source = 'recollect'

      if (user.provider === 'hoboken-static') {
        // Citywide fixed schedule — regenerate locally, no lookup needed.
        events = generateHobokenEvents(90)
      } else if (user.provider === 'jersey-city' || user.provider === 'recyclecoach') {
        const addressKey = normalizeAddress(user.street, user.city, user.state)
        const { data: cached } = await supabase
          .from('place_lookup_cache')
          .select('provider_data')
          .eq('address_key', addressKey)
          .maybeSingle()
        const providerData = (cached?.provider_data ?? null) as Record<string, unknown> | null

        if (user.provider === 'jersey-city') {
          events = jerseyCityEvents(providerData as { garbage_days?: string[]; recycling_days?: string[] } | null, 90)
        } else {
          // deno-lint-ignore no-explicit-any
          const resolved = rcCityAndZonesFromProviderData(providerData as any)
          if (!resolved) { errors++; continue }
          events = await getEventsFromRCZone(resolved.rcCity, resolved.zoneIds, 90)
        }
      } else if (user.provider === 'recollect-ical' && user.ical_url) {
        const parts = parseIcalUrl(user.ical_url)
        if (!parts) { errors++; continue }
        const rawEvents = await getEventsForPlace(parts.placeId, parts.serviceId, after, before)
        events = rawEvents.map(e => ({ date: e.date, event_type: e.event_type }))
      } else if (user.recollect_place_id) {
        const rawEvents = await getEvents(user.recollect_place_id, after, before)
        events = rawEvents.map(e => ({
          date: e.date,
          event_type: normalizeEventType(e.event_type),
        }))
      } else {
        refreshed++
        continue
      }

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
  }

  return new Response(
    JSON.stringify({ slot, users: users.length, refreshed, errors }),
    { headers: { 'Content-Type': 'application/json' } }
  )
}

if (import.meta.main) {
  Deno.serve(handler)
}
