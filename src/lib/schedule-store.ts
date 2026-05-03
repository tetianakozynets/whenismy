import { LookupResponse } from './types'

interface StoredResult {
  result: LookupResponse
  street: string
  city: string
  state: string
}

let stored: StoredResult | null = null

export const scheduleStore = {
  set(result: LookupResponse, street: string, city: string, state: string) {
    stored = { result, street, city, state }
  },
  get(): StoredResult | null {
    return stored
  },
  getResult(): LookupResponse | null {
    return stored?.result ?? null
  },
  clear() {
    stored = null
  },
}
