import { LookupResponse, LookupError } from './types'

export async function lookupSchedule(
  street: string,
  city: string,
  state: string
): Promise<LookupResponse | LookupError> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  try {
    const res = await fetch(`${base}/functions/v1/lookup-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ street, city, state }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return data ?? { error: `Server error (${res.status}) — please try again.` }
    }
    return data
  } catch {
    return { error: 'Network error — check your connection and try again.' }
  }
}

export function isError(
  result: LookupResponse | LookupError
): result is LookupError {
  return 'error' in result
}

export async function lookupByCalendarUrl(
  icalUrl: string
): Promise<LookupResponse | LookupError> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  try {
    const res = await fetch(`${base}/functions/v1/lookup-schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ ical_url: icalUrl }),
    })
    if (!res.ok) {
      return { error: `Server error (${res.status}) — please try again.` }
    }
    return res.json()
  } catch {
    return { error: 'Network error — check your connection and try again.' }
  }
}
