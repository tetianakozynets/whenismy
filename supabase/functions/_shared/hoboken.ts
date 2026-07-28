// supabase/functions/_shared/hoboken.ts

export interface HobokenEvent {
  date: string
  event_type: string
}

const DOW: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function pad(n: number) { return String(n).padStart(2, '0') }

function localStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function nextDow(dow: number, from: Date): Date {
  const diff = (dow - from.getDay() + 7) % 7
  const d = new Date(from)
  d.setDate(d.getDate() + diff)
  return d
}

const SCHEDULE: { dow: string; event_type: string }[] = [
  { dow: 'monday',    event_type: 'garbage' },
  { dow: 'tuesday',   event_type: 'recycling' },   // commingled (plastics, glass, cans)
  { dow: 'thursday',  event_type: 'garbage' },
  { dow: 'friday',    event_type: 'recycling' },   // paper + cardboard
  { dow: 'friday',    event_type: 'bulk_waste' },  // metal furniture, appliances, e-waste
  { dow: 'friday',    event_type: 'yard_waste' },  // seasonal yard/garden waste
  { dow: 'saturday',  event_type: 'garbage' },
]

// Hoboken has a single citywide schedule — same for every address, no zones.
// Source: https://www.hobokennj.gov/resources/waste-collection
export function generateHobokenEvents(daysAhead: number): HobokenEvent[] {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const endMs = start.getTime() + daysAhead * 86_400_000
  const events: HobokenEvent[] = []

  for (const { dow, event_type } of SCHEDULE) {
    const d = nextDow(DOW[dow], start)
    while (d.getTime() < endMs) {
      events.push({ date: localStr(d), event_type })
      d.setDate(d.getDate() + 7)
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date))
}
