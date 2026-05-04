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

// Fixed-date holidays whose canonical date Nager.Date may shift to the
// nearest weekday when they fall on a weekend. We always want to show
// these on their actual calendar date, not the government-observed date.
const FIXED_DATE_HOLIDAYS: Record<string, { month: number; day: number }> = {
  "New Year's Day":                       { month: 1,  day: 1  },
  'Juneteenth National Independence Day': { month: 6,  day: 19 },
  'Independence Day':                     { month: 7,  day: 4  },
  'Veterans Day':                         { month: 11, day: 11 },
  'Christmas Day':                        { month: 12, day: 25 },
}

export async function getUSHolidays(): Promise<HolidayMap> {
  const year = new Date().getFullYear()
  if (_cache && _cachedForYear === year) return _cache
  const [thisYear, nextYear] = await Promise.all([fetchYear(year), fetchYear(year + 1)])
  const map: HolidayMap = new Map()
  for (const h of [...thisYear, ...nextYear]) {
    if (!h.global) continue
    const fixed = FIXED_DATE_HOLIDAYS[h.localName]
    if (fixed) {
      // Snap to canonical date — e.g. Independence Day always July 4,
      // not July 3 or July 5 when Nager.Date shifts for a weekend.
      const y = parseInt(h.date.slice(0, 4), 10)
      const canonical = `${y}-${pad(fixed.month)}-${pad(fixed.day)}`
      map.set(canonical, h.localName)
    } else {
      map.set(h.date, h.localName)
    }
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
