import { canUsePushNotifications, savePushToken } from './push-notifications'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { supabase } from './supabase'

// __esModule: true ensures Babel passes the same object through interop,
// so mutations in this test file are visible to the implementation module.
jest.mock('expo-notifications', () => ({
  __esModule: true,
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}))

jest.mock('expo-device', () => ({
  __esModule: true,
  isDevice: true,
}))

jest.mock('./supabase', () => ({
  supabase: { from: jest.fn() },
}))

beforeEach(() => {
  jest.clearAllMocks()
  ;(Device as any).isDevice = true
})

it('canUsePushNotifications returns false on non-device', async () => {
  ;(Device as any).isDevice = false
  const result = await canUsePushNotifications()
  expect(result).toBe(false)
})

it('canUsePushNotifications returns true when permission granted', async () => {
  ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' })
  expect(await canUsePushNotifications()).toBe(true)
})

it('canUsePushNotifications requests permission when undetermined', async () => {
  ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' })
  ;(Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' })
  expect(await canUsePushNotifications()).toBe(true)
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalled()
})

it('savePushToken upserts to push_tokens', async () => {
  const upsert = jest.fn().mockResolvedValueOnce({ error: null })
  ;(supabase.from as jest.Mock).mockReturnValueOnce({ upsert })
  await savePushToken('u1', 'ExponentPushToken[abc]')
  expect(supabase.from).toHaveBeenCalledWith('push_tokens')
  expect(upsert).toHaveBeenCalledWith(
    { user_id: 'u1', expo_push_token: 'ExponentPushToken[abc]', updated_at: expect.any(String) },
    { onConflict: 'user_id' }
  )
})

it('getExpoPushToken returns token string on success', async () => {
  ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
    data: 'ExponentPushToken[xyz]',
  })
  const { getExpoPushToken } = require('./push-notifications')
  const token = await getExpoPushToken()
  expect(token).toBe('ExponentPushToken[xyz]')
})

it('getExpoPushToken returns null on error', async () => {
  ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockRejectedValueOnce(new Error('no token'))
  const { getExpoPushToken } = require('./push-notifications')
  const token = await getExpoPushToken()
  expect(token).toBeNull()
})

it('registerPushToken saves token when permission granted and on device', async () => {
  ;(Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' })
  ;(Notifications.getExpoPushTokenAsync as jest.Mock).mockResolvedValueOnce({
    data: 'ExponentPushToken[reg]',
  })
  const upsert = jest.fn().mockResolvedValueOnce({ error: null })
  ;(supabase.from as jest.Mock).mockReturnValueOnce({ upsert })
  const { registerPushToken } = require('./push-notifications')
  await registerPushToken('u1')
  expect(upsert).toHaveBeenCalled()
})

it('registerPushToken does nothing when not a device', async () => {
  ;(Device as any).isDevice = false
  const upsert = jest.fn()
  ;(supabase.from as jest.Mock).mockReturnValue({ upsert })
  const { registerPushToken } = require('./push-notifications')
  await registerPushToken('u1')
  expect(upsert).not.toHaveBeenCalled()
  ;(Device as any).isDevice = true
})
