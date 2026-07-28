// supabase/functions/_shared/address.ts

export function normalizeAddress(street: string, city: string, state: string): string {
  return [street, city, state].map(s => s.trim().toLowerCase()).join('|')
}
