import { ensureAnonymousUser } from './auth'
import { saveAddress, savePickupEvents } from './user-api'
import { saveManualSchedules } from './manual-schedule'
import { registerPushToken } from './push-notifications'
import { PlaceInfo, PickupEvent, ManualScheduleInput } from './types'

export async function enableRemindersForAddress(
  street: string,
  city: string,
  state: string,
  place: PlaceInfo,
  events: PickupEvent[]
): Promise<void> {
  const userId = await ensureAnonymousUser()
  const { error: addressError } = await saveAddress(userId, street, city, state, place)
  if (addressError) throw addressError
  const { error: eventsError } = await savePickupEvents(userId, events)
  if (eventsError) throw eventsError
  await registerPushToken(userId)
}

export async function enableRemindersForManualSchedule(
  schedules: ManualScheduleInput[]
): Promise<void> {
  const userId = await ensureAnonymousUser()
  const { error } = await saveManualSchedules(userId, schedules)
  if (error) throw error
  await registerPushToken(userId)
}
