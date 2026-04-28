import { LookupResponse } from './types'

let _result: LookupResponse | null = null

export const scheduleStore = {
  set(r: LookupResponse): void {
    _result = r
  },
  get(): LookupResponse | null {
    return _result
  },
  clear(): void {
    _result = null
  },
}
