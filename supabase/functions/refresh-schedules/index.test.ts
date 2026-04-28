import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { slotForUser } from './index.ts'

Deno.test('slotForUser returns value 0-335', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000'
  const slot = slotForUser(uuid)
  assertEquals(typeof slot, 'number')
  assertEquals(slot >= 0 && slot < 336, true)
})

Deno.test('same uuid always returns same slot', () => {
  const uuid = '550e8400-e29b-41d4-a716-446655440000'
  assertEquals(slotForUser(uuid), slotForUser(uuid))
})
