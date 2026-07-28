import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { slotForUser, usersForSlotFilter } from './index.ts'

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

Deno.test('usersForSlotFilter: includes every supported provider', () => {
  const filter = usersForSlotFilter()
  assertEquals(filter.includes('recollect_place_id.not.is.null'), true)
  for (const provider of ['nyc-dsny', 'recollect-ical', 'hoboken-static', 'jersey-city', 'recyclecoach']) {
    assertEquals(filter.includes(`provider.eq.${provider}`), true, `Missing provider.eq.${provider}`)
  }
})
