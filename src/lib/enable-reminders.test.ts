import { ensureAnonymousUser } from './auth'
import { saveAddress, savePickupEvents } from './user-api'
import { saveManualSchedules } from './manual-schedule'
import { registerPushToken } from './push-notifications'
import { enableRemindersForAddress, enableRemindersForManualSchedule } from './enable-reminders'
import { PlaceInfo, PickupEvent, ManualScheduleInput } from './types'

jest.mock('./auth', () => ({ ensureAnonymousUser: jest.fn() }))
jest.mock('./user-api', () => ({
  saveAddress: jest.fn().mockResolvedValue({ error: null }),
  savePickupEvents: jest.fn().mockResolvedValue({ error: null }),
}))
jest.mock('./manual-schedule', () => ({
  saveManualSchedules: jest.fn().mockResolvedValue({ error: null }),
}))
jest.mock('./push-notifications', () => ({ registerPushToken: jest.fn() }))

const place: PlaceInfo = {
  address_key: '1 main st|mahwah|nj',
  recollect_place_id: 'p1',
  latitude: 40.9,
  longitude: -74.1,
  timezone: 'America/New_York',
  supported_event_types: ['garbage'],
  provider: 'recollect',
}
const events: PickupEvent[] = [{ date: '2026-06-01', event_type: 'garbage' }]

beforeEach(() => {
  jest.clearAllMocks()
  ;(ensureAnonymousUser as jest.Mock).mockResolvedValue('u1')
})

it('enableRemindersForAddress creates an anon user then saves address, events, and push token', async () => {
  await enableRemindersForAddress('1 Main St', 'Mahwah', 'NJ', place, events)
  expect(ensureAnonymousUser).toHaveBeenCalledTimes(1)
  expect(saveAddress).toHaveBeenCalledWith('u1', '1 Main St', 'Mahwah', 'NJ', place)
  expect(savePickupEvents).toHaveBeenCalledWith('u1', events)
  expect(registerPushToken).toHaveBeenCalledWith('u1')
})

it('enableRemindersForManualSchedule creates an anon user then saves manual schedules and push token', async () => {
  const schedules: ManualScheduleInput[] = [
    { event_type: 'garbage', pickup_day: 'monday', frequency: 'weekly', anchor_date: null },
  ]
  await enableRemindersForManualSchedule(schedules)
  expect(ensureAnonymousUser).toHaveBeenCalledTimes(1)
  expect(saveManualSchedules).toHaveBeenCalledWith('u1', schedules)
  expect(registerPushToken).toHaveBeenCalledWith('u1')
})

it('propagates errors from ensureAnonymousUser without saving anything', async () => {
  ;(ensureAnonymousUser as jest.Mock).mockRejectedValueOnce(new Error('network error'))
  await expect(
    enableRemindersForAddress('1 Main St', 'Mahwah', 'NJ', place, events)
  ).rejects.toThrow('network error')
  expect(saveAddress).not.toHaveBeenCalled()
})

it('enableRemindersForAddress throws when saveAddress returns an error', async () => {
  ;(saveAddress as jest.Mock).mockResolvedValueOnce({ error: { message: 'constraint violation' } })
  await expect(
    enableRemindersForAddress('1 Main St', 'Mahwah', 'NJ', place, events)
  ).rejects.toEqual({ message: 'constraint violation' })
  expect(savePickupEvents).not.toHaveBeenCalled()
  expect(registerPushToken).not.toHaveBeenCalled()
})

it('enableRemindersForManualSchedule throws when saveManualSchedules returns an error', async () => {
  const schedules: ManualScheduleInput[] = [
    { event_type: 'garbage', pickup_day: 'monday', frequency: 'weekly', anchor_date: null },
  ]
  ;(saveManualSchedules as jest.Mock).mockResolvedValueOnce({ error: { message: 'constraint violation' } })
  await expect(enableRemindersForManualSchedule(schedules)).rejects.toEqual({ message: 'constraint violation' })
  expect(registerPushToken).not.toHaveBeenCalled()
})
