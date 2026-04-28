import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { buildNotificationQuery } from './index.ts'

Deno.test('buildNotificationQuery returns a string', () => {
  const sql = buildNotificationQuery()
  assertEquals(typeof sql, 'string')
  assertEquals(sql.includes('notify_at'), true)
  assertEquals(sql.includes('pickup_events'), true)
  assertEquals(sql.includes('notification_log'), true)
})
