import { Stack } from 'expo-router'
import { AuthProvider } from '../src/lib/auth-context'

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="schedule" />
        <Stack.Screen name="address-not-found" />
        <Stack.Screen name="calendar-url" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="manual-entry" />
      </Stack>
    </AuthProvider>
  )
}
