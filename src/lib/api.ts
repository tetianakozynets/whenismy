import { LookupResponse, LookupError } from './types'

export async function lookupSchedule(
  street: string,
  city: string,
  state: string
): Promise<LookupResponse | LookupError> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL
  const res = await fetch(`${base}/functions/v1/lookup-schedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ street, city, state }),
  })
  return res.json()
}

export function isError(
  result: LookupResponse | LookupError
): result is LookupError {
  return 'error' in result
}
