export type HolidayMap = Map<string, string>  // YYYY-MM-DD → display name

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

let _cache: HolidayMap | null = null
let _cachedForYear = 0

async function fetchYear(year: number): Promise<{ date: string; localName: string; global: boolean }[]> {
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/US`)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function getUSHolidays(): Promise<HolidayMap> {
  const year = new Date().getFullYear()
  if (_cache && _cachedForYear === year) return _cache
  const [thisYear, nextYear] = await Promise.all([fetchYear(year), fetchYear(year + 1)])
  const map: HolidayMap = new Map()
  for (const h of [...thisYear, ...nextYear]) {
    // Only include nationwide holidays (global: true).
    // State-specific holidays (Truman Day, etc.) have global: false and
    // rarely affect municipal pickup schedules.
    if (h.global) map.set(h.date, h.localName)
  }
  _cache = map
  _cachedForYear = year
  return map
}

/** "2026-05-25" → "May 25" */
export function formatHolidayDate(dateStr: string): string {
  const parts = dateStr.split('-')
  return `${MONTH_NAMES[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function todayHolidayNote(holidays: HolidayMap): string | undefined {
  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const name = holidays.get(today)
  if (name) {
    return `Today is ${name} — many cities have delayed or cancelled pickup. Check your city's website to confirm.`
  }
  const mm = now.getMonth() + 1
  const dd = now.getDate()
  if (mm === 12 && dd === 24) {
    return `Christmas Day is tomorrow — many cities advise not placing bins out tonight.`
  }
  if (mm === 12 && dd === 31) {
    return `New Year's Day is tomorrow — many cities advise not placing bins out tonight.`
  }
  return undefined
}
