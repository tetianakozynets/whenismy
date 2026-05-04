export type HolidayMap = Map<string, string>  // YYYY-MM-DD → display name

let _cache: HolidayMap | null = null
let _cachedForYear = 0

async function fetchYear(year: number): Promise<{ date: string; localName: string }[]> {
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
    map.set(h.date, h.localName)
  }
  _cache = map
  _cachedForYear = year
  return map
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function todayHolidayNote(holidays: HolidayMap): string | undefined {
  const now = new Date()
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const name = holidays.get(today)
  if (name) {
    return `Today is ${name} — many cities have delayed or cancelled pickup. Check your city's website to confirm.`
  }
  // Night-before warnings for Christmas and New Year's
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
