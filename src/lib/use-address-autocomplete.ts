import { useState, useEffect } from 'react'

export interface AddressSuggestion {
  displayName: string
  street: string
  city: string
  state: string
}

export function parseNominatimResult(item: Record<string, unknown>): AddressSuggestion | null {
  const addr = (item.address ?? {}) as Record<string, string>
  const road = addr.road ?? ''
  if (!road) return null

  const street = addr.house_number ? `${addr.house_number} ${road}` : road
  const city = addr.city ?? addr.town ?? addr.village ?? addr.county ?? ''
  const isoCode = addr['ISO3166-2-lvl4'] ?? '' // e.g. "US-NY"
  const state = isoCode.split('-')[1] ?? ''

  if (!city || !state) return null

  return { displayName: `${street}, ${city}, ${state}`, street, city, state }
}

export function useAddressAutocomplete(query: string) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setSuggestions([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const url =
          `https://nominatim.openstreetmap.org/search` +
          `?q=${encodeURIComponent(q)}&format=json&addressdetails=1&countrycodes=us&limit=5`
        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json() as Record<string, unknown>[]
        const parsed = data
          .map(parseNominatimResult)
          .filter((s): s is AddressSuggestion => s !== null)
        const seen = new Set<string>()
        setSuggestions(parsed.filter(s => !seen.has(s.displayName) && !!seen.add(s.displayName)))
      } catch {
        // network failure — show no suggestions
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [query])

  return {
    suggestions,
    clearSuggestions: () => setSuggestions([]),
  }
}
