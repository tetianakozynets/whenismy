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
  await saveAddress(userId, street, city, state, place)
  await savePickupEvents(userId, events)
  await registerPushToken(userId)
}

export async function enableRemindersForManualSchedule(
  schedules: ManualScheduleInput[]
): Promise<void> {
  const userId = await ensureAnonymousUser()
  await saveManualSchedules(userId, schedules)
  await registerPushToken(userId)
}
