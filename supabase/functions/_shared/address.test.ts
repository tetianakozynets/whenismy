// supabase/functions/_shared/address.test.ts
import { normalizeAddress } from './address.ts'

Deno.test('normalizeAddress: trims and lowercases', () => {
  const result = normalizeAddress(' 123 Main St ', 'New York', 'NY')
  if (result !== '123 main st|new york|ny') throw new Error(`Wrong: ${result}`)
})

Deno.test('normalizeAddress: same address always produces the same key', () => {
  const a = normalizeAddress('100 Grove St', 'Jersey City', 'NJ')
  const b = normalizeAddress('100 Grove St', 'Jersey City', 'NJ')
  if (a !== b) throw new Error('Expected identical keys')
})
