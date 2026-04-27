import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getEvents, normalizeEventType } from '../_shared/recollect.ts'

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

export async function getUsersForSlot(
  supabase: ReturnType<typeof createClient>,
  slot: number
) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('user_id, recollect_place_id, supported_event_types')
    .not('recollect_place_id', 'is', null)

  if (error) throw error
  return (data ?? []).filter(u => slotForUser(u.user_id) === slot)
}

async function handler(_req: Request): Promise<Response> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const slot = currentSlot()
  const users = await getUsersForSlot(supabase, slot)

  const after = new Date().toISOString().slice(0, 10)
  const before = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let refreshed = 0
  let errors = 0

  for (const user of users) {
    try {
      const events = await getEvents(user.recollect_place_id, after, before)

      const rows = events.map(e => ({
        user_id: user.user_id,
        event_date: e.date,
        event_type: normalizeEventType(e.event_type),
        source: 'recollect' as const,
        refreshed_at: new Date().toISOString(),
      }))

      await supabase
        .from('pickup_events')
        .delete()
        .eq('user_id', user.user_id)
        .eq('source', 'recollect')
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
