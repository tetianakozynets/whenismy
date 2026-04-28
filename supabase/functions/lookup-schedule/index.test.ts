import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

Deno.test('normalizeAddress returns lowercase trimmed key', async () => {
  const { normalizeAddress } = await import('./index.ts')
  assertEquals(
    normalizeAddress('  123 Main St  ', 'Springfield ', ' NY'),
    '123 main st|springfield|ny'
  )
})

Deno.test('returns 400 when address fields missing', async () => {
  const req = new Request('http://localhost/lookup-schedule', {
    method: 'POST',
    body: JSON.stringify({ street: '123 Main' }),
    headers: { 'Content-Type': 'application/json' },
  })
  const { handler } = await import('./index.ts')
  const res = await handler(req)
  assertEquals(res.status, 400)
  const body = await res.json()
  assertEquals(body.error, 'street, city, and state are required')
})
