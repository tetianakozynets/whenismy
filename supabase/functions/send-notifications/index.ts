import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendPushBatch, pickupNotificationMessage, PushMessage } from '../_shared/push.ts'

export function buildNotificationQuery(): string {
  return `
    select
      up.user_id,
      pt.expo_push_token,
      pe.event_type,
      pe.event_date,
      up.timezone
    from public.user_preferences up
    join public.push_tokens pt on pt.user_id = up.user_id
    join public.pickup_events pe on pe.user_id = up.user_id
    where
      pt.expo_push_token is not null
      and up.notify_at <= now()
      and up.notify_at > now() - interval '30 minutes'
      and pe.event_date = (now() at time zone up.timezone)::date + 1
      and (
        (pe.event_type = 'garbage'    and up.notifications_garbage    = true)
        or (pe.event_type = 'recycling' and up.notifications_recycling  = true)
        or (pe.event_type = 'yard_waste' and up.notifications_yard_waste = true)
      )
      and not exists (
        select 1 from public.notification_log nl
        where nl.user_id = up.user_id
          and nl.event_type = pe.event_type
          and (nl.sent_at at time zone up.timezone)::date
              = (now() at time zone up.timezone)::date
      )
  `
}

async function handler(_req: Request): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), { status: 500 })
  }

  const supabase = createClient(url, key)
  const now = new Date()
  const windowStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString()

  // Fetch users whose notify_at is in the past 30-min window and have a push token
  const { data: candidates, error } = await supabase
    .from('user_preferences')
    .select(`
      user_id,
      timezone,
      notifications_garbage,
      notifications_recycling,
      notifications_yard_waste,
      notify_at,
      push_tokens ( expo_push_token ),
      pickup_events ( event_type, event_date )
    `)
    .lte('notify_at', now.toISOString())
    .gte('notify_at', windowStart)

  if (error) {
    console.error('Failed to fetch candidates', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!candidates || candidates.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  const messages: PushMessage[] = []
  const meta: Array<{ user_id: string; event_type: string }> = []

  for (const user of candidates) {
    const tokens = (user as any).push_tokens
    const events = (user as any).pickup_events
    const token = Array.isArray(tokens) ? tokens[0]?.expo_push_token : tokens?.expo_push_token
    if (!token) continue

    // Today's date in user's local timezone (YYYY-MM-DD)
    const localToday = now.toLocaleDateString('en-CA', { timeZone: user.timezone })
    // Tomorrow's date in user's local timezone
    const localTomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      .toLocaleDateString('en-CA', { timeZone: user.timezone })

    // Fetch already-sent notifications for this user today (dedup)
    const { data: alreadySent } = await supabase
      .from('notification_log')
      .select('event_type')
      .eq('user_id', user.user_id)
      .gte('sent_at', new Date(localToday).toISOString())
      .lt('sent_at', new Date(localTomorrow).toISOString())

    const alreadySentTypes = new Set((alreadySent ?? []).map((r: any) => r.event_type))

    for (const event of (Array.isArray(events) ? events : [events])) {
      if (!event?.event_type || !event?.event_date) continue

      // Only notify for tomorrow's pickups
      if (event.event_date !== localTomorrow) continue

      const enabled =
        (event.event_type === 'garbage' && user.notifications_garbage) ||
        (event.event_type === 'recycling' && user.notifications_recycling) ||
        (event.event_type === 'yard_waste' && user.notifications_yard_waste)
      if (!enabled) continue

      // Skip if already notified today for this event type
      if (alreadySentTypes.has(event.event_type)) continue

      messages.push(pickupNotificationMessage(event.event_type, token))
      meta.push({ user_id: user.user_id, event_type: event.event_type })
    }
  }

  if (messages.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  let tickets
  try {
    tickets = await sendPushBatch(messages)
  } catch (err) {
    console.error('Expo push batch failed', err)
    return new Response(JSON.stringify({ error: 'Push delivery failed' }), { status: 502 })
  }

  const logRows = meta.map((m, i) => ({
    user_id: m.user_id,
    event_type: m.event_type,
    status: tickets[i]?.status === 'ok' ? 'sent' : 'failed',
    expo_ticket_id: tickets[i]?.id ?? null,
  }))

  try {
    await supabase.from('notification_log').insert(logRows)
  } catch (err) {
    console.error('Failed to log notifications', err)
  }

  const sent = logRows.filter(r => r.status === 'sent').length
  const failed = logRows.filter(r => r.status === 'failed').length

  return new Response(JSON.stringify({ sent, failed }), { status: 200 })
}

if (import.meta.main) {
  Deno.serve(handler)
}
