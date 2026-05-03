import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function canUsePushNotifications(): Promise<boolean> {
  if (!Device.isDevice) return false
  const { status: existing } = await Notifications.getPermissionsAsync()
  if (existing === 'granted') return true
  if (existing === 'undetermined') {
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  }
  return false
}

export async function getExpoPushToken(): Promise<string | null> {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync()
    return data
  } catch {
    return null
  }
}

export async function savePushToken(userId: string, token: string) {
  return supabase.from('push_tokens').upsert(
    { user_id: userId, expo_push_token: token, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )
}

export async function registerPushToken(userId: string): Promise<void> {
  const allowed = await canUsePushNotifications()
  if (!allowed) return
  const token = await getExpoPushToken()
  if (token) await savePushToken(userId, token)
}
