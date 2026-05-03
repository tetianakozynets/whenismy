import { ManualScheduleInput, PickupEvent } from './types'
import { supabase } from './supabase'

const DOW_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

export function generateEventsFromManual(
  schedule: ManualScheduleInput,
  daysAhead = 60,
  startDate: Date = new Date()
): PickupEvent[] {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const endMs = start.getTime() + daysAhead * 86_400_000

  if (schedule.frequency === 'biweekly') {
    if (!schedule.anchor_date) return []
    const anchor = new Date(schedule.anchor_date + 'T12:00:00')
    const events: PickupEvent[] = []
    const d = new Date(anchor)
    // step forward from anchor until on or after start
    while (d.getTime() < start.getTime()) d.setDate(d.getDate() + 14)
    while (d.getTime() < endMs) {
      events.push({ date: toDateStr(d), event_type: schedule.event_type })
      d.setDate(d.getDate() + 14)
    }
    return events
  }

  // weekly
  const targetDow = DOW_INDEX[schedule.pickup_day]
  const events: PickupEvent[] = []
  const diff = (targetDow - start.getDay() + 7) % 7
  const d = new Date(start)
  d.setDate(d.getDate() + diff)
  while (d.getTime() < endMs) {
    events.push({ date: toDateStr(d), event_type: schedule.event_type })
    d.setDate(d.getDate() + 7)
  }
  return events
}

export async function saveManualSchedules(
  userId: string,
  schedules: ManualScheduleInput[]
) {
  // Deactivate old manual schedules
  await supabase
    .from('manual_schedules')
    .update({ active: false })
    .eq('user_id', userId)

  // Insert new schedules
  const { error } = await supabase.from('manual_schedules').insert(
    schedules.map(s => ({
      user_id: userId,
      event_type: s.event_type,
      pickup_day: s.pickup_day,
      frequency: s.frequency,
      anchor_date: s.anchor_date,
      active: true,
    }))
  )
  if (error) return { error }

  // Generate and save pickup_events
  const allEvents = schedules.flatMap(s => generateEventsFromManual(s))
  const now = new Date().toISOString()
  return supabase.from('pickup_events').insert(
    allEvents.map(e => ({
      user_id: userId,
      event_date: e.date,
      event_type: e.event_type,
      source: 'manual',
      refreshed_at: now,
    }))
  )
}
