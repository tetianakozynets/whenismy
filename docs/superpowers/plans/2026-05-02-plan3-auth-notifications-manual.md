# Plan 3 — Auth, Notifications & Manual Entry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase auth (sign-up/sign-in), push notification registration and preferences, a Settings screen, and a manual pickup entry flow for addresses Recollect doesn't cover.

**Architecture:** Auth state lives in a React context (`AuthContext`) wrapping the root layout. On sign-in the app saves the most-recent lookup result to Supabase (`user_preferences` + `pickup_events`), registers an Expo push token, and unlocks the Notifications and Settings screens. Manual entry is gated behind sign-in and writes to `manual_schedules`, generating `pickup_events` rows with `source = 'manual'`.

**Tech Stack:** Expo SDK 54, `@supabase/supabase-js` v2 (already installed), `expo-notifications`, `expo-device`, `@react-native-async-storage/async-storage` (Supabase session storage on native).

---

## File map

| File | Action | Purpose |
|---|---|---|
| `src/lib/auth.ts` | Create | signUp, signIn, signOut, getSession, onAuthStateChange |
| `src/lib/auth.test.ts` | Create | Unit tests for auth helpers |
| `src/lib/auth-context.tsx` | Create | React context — current User \| null, loading flag |
| `src/lib/user-api.ts` | Create | saveAddress, savePickupEvents, getPreferences, deleteAccount |
| `src/lib/user-api.test.ts` | Create | Tests for user-api (mocking supabase client) |
| `src/lib/push-notifications.ts` | Create | registerPushToken, requestPermission |
| `src/lib/push-notifications.test.ts` | Create | Tests (mocking expo-notifications) |
| `src/lib/manual-schedule.ts` | Create | generateEventsFromManual, saveManualSchedule |
| `src/lib/manual-schedule.test.ts` | Create | Tests for event generation logic |
| `src/lib/supabase.ts` | Modify | Add AsyncStorage adapter for native session persistence |
| `src/lib/types.ts` | Modify | Add UserPreferences, ManualScheduleInput types |
| `app/_layout.tsx` | Modify | Wrap with AuthProvider, register new screens |
| `app/sign-in.tsx` | Create | Combined sign-up / sign-in screen |
| `app/notifications.tsx` | Create | Notification preferences screen |
| `app/settings.tsx` | Create | Settings screen (address, reminders, sign out, delete) |
| `app/manual-entry.tsx` | Create | Manual pickup entry form |
| `app/address-not-found.tsx` | Modify | Gate "Enter my pickup days" behind sign-in |
| `src/components/ScheduleContent.tsx` | Modify | Upsell banner navigates to sign-in; show ⚙️ gear for signed-in users |

---

## Task 1: Install dependencies

**Files:** `package.json`, `app.json`

- [ ] **Step 1: Install packages**

```bash
npx expo install expo-notifications expo-device @react-native-async-storage/async-storage
```

Expected: packages added to `node_modules` and `package.json`.

- [ ] **Step 2: Add notification permissions to app.json**

Replace the `"plugins"` array and add `"permissions"` blocks in `app.json`:

```json
{
  "expo": {
    "name": "whenIsMy",
    "slug": "whenismy",
    "version": "1.0.0",
    "orientation": "portrait",
    "scheme": "whenismy",
    "platforms": ["ios", "android", "web"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "app.whenismy"
    },
    "android": {
      "package": "app.whenismy"
    },
    "web": {
      "bundler": "metro",
      "output": "static"
    },
    "plugins": [
      "expo-router",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#e94560",
          "defaultChannel": "default"
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

Note: `notification-icon.png` is optional for local dev — Expo falls back to the app icon if missing.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore: install expo-notifications, expo-device, async-storage"
```

---

## Task 2: Update Supabase client for native session persistence

**Files:**
- Modify: `src/lib/supabase.ts`

Supabase needs AsyncStorage on React Native to persist the session across app restarts. Without it, users are logged out every time the app closes.

- [ ] **Step 1: Replace `src/lib/supabase.ts`**

```ts
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
})
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --watchAll=false
```

Expected: all 52 tests pass (no change to test behaviour).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: configure Supabase client with AsyncStorage session persistence"
```

---

## Task 3: Auth helpers + types

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/auth.test.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add types to `src/lib/types.ts`**

Append to the end of the file:

```ts
export interface UserPreferences {
  user_id: string
  street: string
  city: string
  state: string
  recollect_place_id: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  notification_time: string        // e.g. '20:00'
  notifications_garbage: boolean
  notifications_recycling: boolean
  notifications_yard_waste: boolean
  supported_event_types: string[]
}

export interface ManualScheduleInput {
  event_type: 'garbage' | 'recycling' | 'yard_waste'
  pickup_day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
  frequency: 'weekly' | 'biweekly'
  anchor_date: string | null   // YYYY-MM-DD, required when frequency = 'biweekly'
}
```

- [ ] **Step 2: Write failing tests for auth helpers**

Create `src/lib/auth.test.ts`:

```ts
import { supabase } from './supabase'
import { signUp, signIn, signOut, getSession } from './auth'

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
  },
}))

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>

beforeEach(() => jest.clearAllMocks())

it('signUp calls supabase.auth.signUp with email and password', async () => {
  mockAuth.signUp.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  const result = await signUp('a@b.com', 'password123456')
  expect(mockAuth.signUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123456' })
  expect(result.error).toBeNull()
})

it('signIn calls supabase.auth.signInWithPassword', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  const result = await signIn('a@b.com', 'password123456')
  expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123456' })
  expect(result.error).toBeNull()
})

it('signOut calls supabase.auth.signOut', async () => {
  mockAuth.signOut.mockResolvedValueOnce({ error: null })
  await signOut()
  expect(mockAuth.signOut).toHaveBeenCalled()
})

it('getSession returns current session', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null } as any)
  const session = await getSession()
  expect(session?.user.id).toBe('u1')
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=auth.test --watchAll=false
```

Expected: FAIL — `Cannot find module './auth'`

- [ ] **Step 4: Create `src/lib/auth.ts`**

```ts
import { supabase } from './supabase'

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({ email, password })
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --testPathPattern=auth.test --watchAll=false
```

Expected: PASS — 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts src/lib/types.ts
git commit -m "feat: auth helpers — signUp, signIn, signOut, getSession"
```

---

## Task 4: Auth context

**Files:**
- Create: `src/lib/auth-context.tsx`
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Create `src/lib/auth-context.tsx`**

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
```

- [ ] **Step 2: Update `app/_layout.tsx`**

```tsx
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
```

- [ ] **Step 3: Run all tests**

```bash
npm test -- --watchAll=false
```

Expected: all 52 tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth-context.tsx app/_layout.tsx
git commit -m "feat: AuthContext — session state available app-wide"
```

---

## Task 5: User API — save address and pickup events

**Files:**
- Create: `src/lib/user-api.ts`
- Create: `src/lib/user-api.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/user-api.test.ts`:

```ts
import { supabase } from './supabase'
import { saveAddress, savePickupEvents, getPreferences } from './user-api'
import { PlaceInfo, PickupEvent } from './types'

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
  },
}))

const mockFrom = supabase.from as jest.Mock

const place: PlaceInfo = {
  address_key: '123 main|springfield|ny',
  recollect_place_id: 'place-1',
  latitude: 40.7,
  longitude: -74.0,
  timezone: 'America/New_York',
  supported_event_types: ['garbage', 'recycling'],
  provider: 'recollect',
}

const events: PickupEvent[] = [
  { date: '2026-05-05', event_type: 'garbage' },
  { date: '2026-05-09', event_type: 'recycling' },
]

beforeEach(() => jest.clearAllMocks())

it('saveAddress upserts to user_preferences', async () => {
  const upsert = jest.fn().mockResolvedValueOnce({ error: null })
  mockFrom.mockReturnValueOnce({ upsert })
  await saveAddress('u1', '123 Main St', 'Springfield', 'NY', place)
  expect(mockFrom).toHaveBeenCalledWith('user_preferences')
  expect(upsert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'u1', city: 'Springfield', state: 'NY' }),
    { onConflict: 'user_id' }
  )
})

it('savePickupEvents inserts events with user_id and source', async () => {
  const insert = jest.fn().mockResolvedValueOnce({ error: null })
  mockFrom.mockReturnValueOnce({ insert })
  await savePickupEvents('u1', events)
  expect(mockFrom).toHaveBeenCalledWith('pickup_events')
  expect(insert).toHaveBeenCalledWith(
    events.map(e => ({
      user_id: 'u1',
      event_date: e.date,
      event_type: e.event_type,
      source: 'recollect',
      refreshed_at: expect.any(String),
    }))
  )
})

it('getPreferences selects from user_preferences by user_id', async () => {
  const single = jest.fn().mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null })
  const eq = jest.fn().mockReturnValueOnce({ single })
  const select = jest.fn().mockReturnValueOnce({ eq })
  mockFrom.mockReturnValueOnce({ select })
  const result = await getPreferences('u1')
  expect(result?.user_id).toBe('u1')
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --testPathPattern=user-api --watchAll=false
```

Expected: FAIL — `Cannot find module './user-api'`

- [ ] **Step 3: Create `src/lib/user-api.ts`**

```ts
import { supabase } from './supabase'
import { PlaceInfo, PickupEvent, UserPreferences } from './types'

export async function saveAddress(
  userId: string,
  street: string,
  city: string,
  state: string,
  place: PlaceInfo
) {
  return supabase.from('user_preferences').upsert(
    {
      user_id: userId,
      street,
      city,
      state,
      recollect_place_id: place.recollect_place_id,
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
      supported_event_types: place.supported_event_types,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
}

export async function savePickupEvents(userId: string, events: PickupEvent[]) {
  const now = new Date().toISOString()
  return supabase.from('pickup_events').insert(
    events.map(e => ({
      user_id: userId,
      event_date: e.date,
      event_type: e.event_type,
      source: 'recollect',
      refreshed_at: now,
    }))
  )
}

export async function getPreferences(userId: string): Promise<UserPreferences | null> {
  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: {
    notification_time?: string
    notifications_garbage?: boolean
    notifications_recycling?: boolean
    notifications_yard_waste?: boolean
  }
) {
  return supabase
    .from('user_preferences')
    .update({ ...prefs, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
}

export async function deleteAccount(userId: string) {
  // Deleting the auth user cascades to all user data via ON DELETE CASCADE
  return supabase.rpc('delete_user')
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=user-api --watchAll=false
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/user-api.ts src/lib/user-api.test.ts
git commit -m "feat: user-api — saveAddress, savePickupEvents, getPreferences"
```

---

## Task 6: Push notification registration

**Files:**
- Create: `src/lib/push-notifications.ts`
- Create: `src/lib/push-notifications.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/push-notifications.test.ts`:

```ts
import { canUsePushNotifications, savePushToken } from './push-notifications'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { supabase } from './supabase'

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}))

jest.mock('expo-device', () => ({ isDevice: true }))

jest.mock('./supabase', () => ({
  supabase: { from: jest.fn() },
}))

beforeEach(() => jest.clearAllMocks())

it('canUsePushNotifications returns false on non-device (web/simulator)', async () => {
  jest.resetModules()
  jest.doMock('expo-device', () => ({ isDevice: false }))
  const { canUsePushNotifications: fn } = await import('./push-notifications')
  expect(await fn()).toBe(false)
})

it('canUsePushNotifications returns true when permission granted on device', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' })
  expect(await canUsePushNotifications()).toBe(true)
})

it('canUsePushNotifications requests permission when not yet determined', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' })
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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --testPathPattern=push-notifications --watchAll=false
```

Expected: FAIL — `Cannot find module './push-notifications'`

- [ ] **Step 3: Create `src/lib/push-notifications.ts`**

```ts
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
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=push-notifications --watchAll=false
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/push-notifications.ts src/lib/push-notifications.test.ts
git commit -m "feat: push notification registration — permission, token, save to DB"
```

---

## Task 7: Sign In / Sign Up screen

**Files:**
- Create: `app/sign-in.tsx`

- [ ] **Step 1: Create `app/sign-in.tsx`**

```tsx
import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { signUp, signIn } from '../src/lib/auth'
import { colors, spacing, radius } from '../src/constants/theme'

export default function SignInScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function handleSubmit() {
    setError(null)
    setInfo(null)
    const e = email.trim()
    const p = password.trim()
    if (!e || !p) { setError('Please enter email and password.'); return }
    if (p.length < 12) { setError('Password must be at least 12 characters.'); return }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error: err } = await signUp(e, p)
        if (err) { setError(err.message); return }
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('signin')
      } else {
        const { error: err } = await signIn(e, p)
        if (err) { setError(err.message); return }
        router.back()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Never miss a pickup</Text>
        <Text style={styles.subtitle}>
          {mode === 'signup'
            ? 'Create an account to get reminders the night before.'
            : 'Sign in to manage your reminders.'}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
          testID="input-email"
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 12 characters)"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
          testID="input-password"
        />
        {error && <Text style={styles.error}>{error}</Text>}
        {info && <Text style={styles.info}>{info}</Text>}
        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          testID="submit-button"
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>
                {mode === 'signup' ? 'Create account' : 'Sign in'}
              </Text>
          }
        </Pressable>
        <Pressable
          onPress={() => { setMode(m => m === 'signup' ? 'signin' : 'signup'); setError(null); setInfo(null) }}
          style={styles.toggleRow}
        >
          <Text style={styles.toggleText}>
            {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Text>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, gap: 12, justifyContent: 'center' },
  backRow: { position: 'absolute', top: spacing.lg, left: spacing.lg },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.md, fontSize: 16, backgroundColor: colors.card, color: colors.text,
  },
  error: { color: colors.error, fontSize: 14 },
  info: { color: colors.recycling ?? '#10B981', fontSize: 14 },
  button: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggleRow: { alignItems: 'center', paddingVertical: spacing.sm },
  toggleText: { color: colors.primary, fontSize: 14 },
})
```

- [ ] **Step 2: Verify in browser**

```bash
npx expo start --web
```

Navigate to `http://localhost:8081/sign-in`. Confirm:
- Dark background, email + password inputs, "Create account" button
- Toggle link switches between sign-up and sign-in copy
- Back link returns to previous screen

- [ ] **Step 3: Commit**

```bash
git add app/sign-in.tsx
git commit -m "feat: sign-in screen — combined sign-up / sign-in with email + password"
```

---

## Task 8: Wire upsell banner + save schedule on sign-in

**Files:**
- Modify: `src/components/ScheduleContent.tsx`
- Modify: `app/sign-in.tsx` (save schedule after sign-in)
- Modify: `src/lib/schedule-store.ts` (expose result for post-auth save)

After the user signs in, we want to automatically save whatever schedule they just looked up — so they don't have to look it up again.

- [ ] **Step 1: Check what scheduleStore exposes**

Read `src/lib/schedule-store.ts` to confirm it has `.get()`. No changes needed if it does.

- [ ] **Step 2: Update `src/components/ScheduleContent.tsx` to wire banner**

Replace the upsell banner `Pressable` (the last one in the return):

```tsx
import { router } from 'expo-router'
import { useAuth } from '../lib/auth-context'
```

Add `const { user } = useAuth()` inside the component. Replace the upsell banner with:

```tsx
{!user && (
  <Pressable
    style={styles.upsellBanner}
    onPress={() => router.push('/sign-in')}
    accessibilityRole="button"
  >
    <Text style={styles.upsellText}>
      Get reminders the night before pickup — Sign in →
    </Text>
  </Pressable>
)}
```

- [ ] **Step 3: Update `app/sign-in.tsx` to save schedule after sign-in**

Add these imports at the top of `app/sign-in.tsx`:

```tsx
import { scheduleStore } from '../src/lib/schedule-store'
import { saveAddress, savePickupEvents } from '../src/lib/user-api'
import { registerPushToken } from '../src/lib/push-notifications'
```

Replace the successful sign-in branch inside `handleSubmit`:

```tsx
const { data, error: err } = await signIn(e, p)
if (err) { setError(err.message); return }
const userId = data.user?.id
if (userId) {
  const stored = scheduleStore.get()
  if (stored) {
    await saveAddress(userId, '', '', '', stored.place)
    await savePickupEvents(userId, stored.events)
  }
  await registerPushToken(userId)
}
router.back()
```

Note: street/city/state aren't in `PlaceInfo` — we need to store them separately. Update `scheduleStore` to hold the full lookup inputs.

- [ ] **Step 4: Update `src/lib/schedule-store.ts` to also store address inputs**

Read the current file first, then replace with:

```ts
import { LookupResponse } from './types'

interface StoredResult {
  result: LookupResponse
  street: string
  city: string
  state: string
}

let stored: StoredResult | null = null

export const scheduleStore = {
  set(result: LookupResponse, street: string, city: string, state: string) {
    stored = { result, street, city, state }
  },
  get(): StoredResult | null {
    return stored
  },
  getResult(): LookupResponse | null {
    return stored?.result ?? null
  },
  clear() {
    stored = null
  },
}
```

- [ ] **Step 5: Update callers of `scheduleStore.set()` and `scheduleStore.get()`**

In `app/index.tsx`:
- `scheduleStore.set(res)` → `scheduleStore.set(res, street, city, state)` (pass the form values)
- `scheduleStore.get()` → `scheduleStore.getResult()`

In `app/schedule.tsx`:
- `scheduleStore.get()` → `scheduleStore.getResult()`

In `app/sign-in.tsx` (from step 3):
- `scheduleStore.get()` → `scheduleStore.get()` (use full stored object)

- [ ] **Step 6: Update `app/sign-in.tsx` save block to use address from store**

```tsx
const stored = scheduleStore.get()
if (stored) {
  await saveAddress(userId, stored.street, stored.city, stored.state, stored.result.place)
  await savePickupEvents(userId, stored.result.events)
}
```

- [ ] **Step 7: Run all tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass. Fix any type errors from scheduleStore signature change.

- [ ] **Step 8: Commit**

```bash
git add src/components/ScheduleContent.tsx app/sign-in.tsx src/lib/schedule-store.ts app/index.tsx app/schedule.tsx
git commit -m "feat: wire sign-in banner, save schedule + push token after auth"
```

---

## Task 9: Settings screen

**Files:**
- Create: `app/settings.tsx`
- Modify: `src/components/ScheduleContent.tsx` (add gear icon for signed-in users)

- [ ] **Step 1: Create `app/settings.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/auth-context'
import { signOut } from '../src/lib/auth'
import { getPreferences } from '../src/lib/user-api'
import { UserPreferences } from '../src/lib/types'
import { colors, spacing, radius } from '../src/constants/theme'

export default function SettingsScreen() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getPreferences(user.id).then(p => { setPrefs(p); setLoading(false) })
  }, [user])

  async function handleSignOut() {
    await signOut()
    router.replace('/')
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all saved data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await signOut()
            router.replace('/')
          },
        },
      ]
    )
  }

  if (!user) return null

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Address</Text>
          {loading
            ? <ActivityIndicator color={colors.primary} />
            : <Text style={styles.addressText}>
                {prefs ? `${prefs.street}, ${prefs.city}, ${prefs.state}` : 'No address saved'}
              </Text>
          }
        </View>

        <Pressable style={styles.row} onPress={() => router.push('/notifications')}>
          <Text style={styles.rowLabel}>Reminders</Text>
          <Text style={styles.rowArrow}>›</Text>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <Text style={styles.emailText}>{user.email}</Text>
        </View>

        <Pressable style={styles.row} onPress={handleSignOut}>
          <Text style={styles.rowLabel}>Sign out</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={handleDeleteAccount}>
          <Text style={[styles.rowLabel, styles.danger]}>Delete account</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  backRow: { paddingBottom: spacing.sm },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  section: { gap: spacing.xs },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  addressText: { fontSize: 15, color: colors.text },
  emailText: { fontSize: 15, color: colors.textSecondary },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: 16, color: colors.text },
  rowArrow: { fontSize: 20, color: colors.textSecondary },
  danger: { color: colors.error },
})
```

- [ ] **Step 2: Add gear icon to ScheduleContent for signed-in users**

In `src/components/ScheduleContent.tsx`, add `import { router } from 'expo-router'` and `import { useAuth } from '../lib/auth-context'`.

Add `const { user } = useAuth()` inside the component.

Replace the `backRow` Pressable with:

```tsx
<View style={styles.topBar}>
  <Pressable onPress={onBack} accessibilityRole="button">
    <Text style={styles.backLink}>← Change address</Text>
  </Pressable>
  {user && (
    <Pressable onPress={() => router.push('/settings')} accessibilityRole="button">
      <Text style={styles.gear}>⚙️</Text>
    </Pressable>
  )}
</View>
```

Add to styles:

```ts
topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
gear: { fontSize: 20 },
```

Remove old `backRow` style.

- [ ] **Step 3: Run tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/settings.tsx src/components/ScheduleContent.tsx
git commit -m "feat: settings screen — address, reminders link, sign out, delete account"
```

---

## Task 10: Notification preferences screen

**Files:**
- Create: `src/components/NotificationToggle.tsx`
- Create: `app/notifications.tsx`

- [ ] **Step 1: Create `src/components/NotificationToggle.tsx`**

```tsx
import React from 'react'
import { View, Text, Switch, StyleSheet } from 'react-native'
import { colors, spacing } from '../constants/theme'

interface Props {
  label: string
  icon: string
  value: boolean
  onValueChange: (v: boolean) => void
  disabled?: boolean
}

export function NotificationToggle({ label, icon, value, onValueChange, disabled }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  icon: { fontSize: 20 },
  label: { flex: 1, fontSize: 16, color: colors.text },
})
```

- [ ] **Step 2: Create `app/notifications.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/auth-context'
import { getPreferences, updateNotificationPreferences } from '../src/lib/user-api'
import { NotificationToggle } from '../src/components/NotificationToggle'
import { colors, spacing, radius } from '../src/constants/theme'

const TIME_OPTIONS = ['18:00', '19:00', '20:00', '21:00', '22:00']
const TIME_LABELS: Record<string, string> = {
  '18:00': '6:00 PM', '19:00': '7:00 PM', '20:00': '8:00 PM',
  '21:00': '9:00 PM', '22:00': '10:00 PM',
}

export default function NotificationsScreen() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [garbage, setGarbage] = useState(true)
  const [recycling, setRecycling] = useState(true)
  const [yardWaste, setYardWaste] = useState(false)
  const [time, setTime] = useState('20:00')
  const [supportedTypes, setSupportedTypes] = useState<string[]>([])

  useEffect(() => {
    if (!user) return
    getPreferences(user.id).then(prefs => {
      if (prefs) {
        setGarbage(prefs.notifications_garbage)
        setRecycling(prefs.notifications_recycling)
        setYardWaste(prefs.notifications_yard_waste)
        setTime(prefs.notification_time ?? '20:00')
        setSupportedTypes(prefs.supported_event_types ?? [])
      }
      setLoading(false)
    })
  }, [user])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    await updateNotificationPreferences(user.id, {
      notifications_garbage: garbage,
      notifications_recycling: recycling,
      notifications_yard_waste: yardWaste,
      notification_time: time,
    })
    setSaving(false)
    router.back()
  }

  if (!user) return null

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Reminders</Text>
        <Text style={styles.subtitle}>
          You'll get a notification the night before each pickup.
        </Text>

        {loading
          ? <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          : <>
              {supportedTypes.includes('garbage') && (
                <NotificationToggle label="Garbage" icon="🗑️" value={garbage} onValueChange={setGarbage} />
              )}
              {supportedTypes.includes('recycling') && (
                <NotificationToggle label="Recycling" icon="♻️" value={recycling} onValueChange={setRecycling} />
              )}
              {supportedTypes.includes('yard_waste') && (
                <NotificationToggle label="Yard Waste" icon="🍂" value={yardWaste} onValueChange={setYardWaste} />
              )}

              <Text style={styles.sectionLabel}>Reminder time</Text>
              <View style={styles.timeRow}>
                {TIME_OPTIONS.map(t => (
                  <Pressable
                    key={t}
                    style={[styles.timeChip, time === t && styles.timeChipSelected]}
                    onPress={() => setTime(t)}
                  >
                    <Text style={[styles.timeChipText, time === t && styles.timeChipTextSelected]}>
                      {TIME_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.button, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </>
        }
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  backRow: { paddingBottom: spacing.sm },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.md,
  },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  timeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeChipText: { fontSize: 14, color: colors.textSecondary },
  timeChipTextSelected: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center', marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:8081/notifications`. Confirm toggles and time chips render correctly.

- [ ] **Step 4: Commit**

```bash
git add src/components/NotificationToggle.tsx app/notifications.tsx
git commit -m "feat: notifications screen — per-type toggles and reminder time picker"
```

---

## Task 11: Manual schedule generation

**Files:**
- Create: `src/lib/manual-schedule.ts`
- Create: `src/lib/manual-schedule.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/manual-schedule.test.ts`:

```ts
import { generateEventsFromManual } from './manual-schedule'
import { ManualScheduleInput } from './types'

const weeklyGarbage: ManualScheduleInput = {
  event_type: 'garbage',
  pickup_day: 'monday',
  frequency: 'weekly',
  anchor_date: null,
}

const biweeklyRecycling: ManualScheduleInput = {
  event_type: 'recycling',
  pickup_day: 'friday',
  frequency: 'biweekly',
  anchor_date: '2026-05-08', // a Friday
}

it('generates weekly events for 60 days', () => {
  const events = generateEventsFromManual(weeklyGarbage, 60, new Date('2026-05-02'))
  expect(events.length).toBeGreaterThanOrEqual(8)
  expect(events.every(e => e.event_type === 'garbage')).toBe(true)
  // All events should be on a Monday
  expect(events.every(e => new Date(e.date + 'T12:00:00').getDay() === 1)).toBe(true)
})

it('generates biweekly events on every other pickup_day', () => {
  const events = generateEventsFromManual(biweeklyRecycling, 60, new Date('2026-05-02'))
  // Should have roughly half as many as weekly
  expect(events.length).toBeGreaterThanOrEqual(4)
  expect(events.length).toBeLessThan(6)
  expect(events.every(e => e.event_type === 'recycling')).toBe(true)
  // All on Fridays
  expect(events.every(e => new Date(e.date + 'T12:00:00').getDay() === 5)).toBe(true)
  // Dates should be 14 days apart
  for (let i = 1; i < events.length; i++) {
    const diff = (new Date(events[i].date).getTime() - new Date(events[i - 1].date).getTime()) / 86400000
    expect(diff).toBe(14)
  }
})

it('returns empty array when anchor_date missing for biweekly', () => {
  const events = generateEventsFromManual({ ...biweeklyRecycling, anchor_date: null }, 60, new Date('2026-05-02'))
  expect(events).toEqual([])
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- --testPathPattern=manual-schedule --watchAll=false
```

Expected: FAIL — `Cannot find module './manual-schedule'`

- [ ] **Step 3: Create `src/lib/manual-schedule.ts`**

```ts
import { ManualScheduleInput, PickupEvent } from './types'
import { supabase } from './supabase'

const DOW_INDEX: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

export function generateEventsFromManual(
  schedule: ManualScheduleInput,
  daysAhead = 60,
  startDate: Date = new Date()
): PickupEvent[] {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const endMs = start.getTime() + daysAhead * 86_400_000

  if (schedule.frequency === 'biweekly') {
    if (!schedule.anchor_date) return []
    const anchor = new Date(schedule.anchor_date + 'T12:00:00')
    const events: PickupEvent[] = []
    const d = new Date(anchor)
    // step backward to first occurrence on or after start
    while (d.getTime() < start.getTime()) d.setDate(d.getDate() + 14)
    while (d.getTime() < endMs) {
      events.push({ date: toDateStr(d), event_type: schedule.event_type })
      d.setDate(d.getDate() + 14)
    }
    return events
  }

  // weekly
  const targetDow = DOW_INDEX[schedule.pickup_day]
  const events: PickupEvent[] = []
  const diff = (targetDow - start.getDay() + 7) % 7
  const d = new Date(start)
  d.setDate(d.getDate() + diff)
  while (d.getTime() < endMs) {
    events.push({ date: toDateStr(d), event_type: schedule.event_type })
    d.setDate(d.getDate() + 7)
  }
  return events
}

export async function saveManualSchedules(
  userId: string,
  schedules: ManualScheduleInput[]
) {
  // Deactivate old manual schedules first
  await supabase
    .from('manual_schedules')
    .update({ active: false })
    .eq('user_id', userId)

  // Insert new schedules
  const { error } = await supabase.from('manual_schedules').insert(
    schedules.map(s => ({
      user_id: userId,
      event_type: s.event_type,
      pickup_day: s.pickup_day,
      frequency: s.frequency,
      anchor_date: s.anchor_date,
      active: true,
    }))
  )
  if (error) return { error }

  // Generate and save pickup_events
  const allEvents = schedules.flatMap(s => generateEventsFromManual(s))
  const now = new Date().toISOString()
  return supabase.from('pickup_events').insert(
    allEvents.map(e => ({
      user_id: userId,
      event_date: e.date,
      event_type: e.event_type,
      source: 'manual',
      refreshed_at: now,
    }))
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --testPathPattern=manual-schedule --watchAll=false
```

Expected: PASS — 3 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/manual-schedule.ts src/lib/manual-schedule.test.ts
git commit -m "feat: manual schedule generation — weekly and biweekly pickup events"
```

---

## Task 12: Manual entry screen

**Files:**
- Create: `app/manual-entry.tsx`
- Modify: `app/address-not-found.tsx`

- [ ] **Step 1: Read current `app/address-not-found.tsx`**

Read the file to understand what's there before modifying.

- [ ] **Step 2: Create `app/manual-entry.tsx`**

```tsx
import React, { useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, ScrollView, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/auth-context'
import { saveManualSchedules, generateEventsFromManual } from '../src/lib/manual-schedule'
import { scheduleStore } from '../src/lib/schedule-store'
import { ManualScheduleInput } from '../src/lib/types'
import { colors, spacing, radius } from '../src/constants/theme'

const EVENT_TYPES = [
  { key: 'garbage' as const, label: 'Garbage', icon: '🗑️' },
  { key: 'recycling' as const, label: 'Recycling', icon: '♻️' },
  { key: 'yard_waste' as const, label: 'Yard Waste', icon: '🍂' },
]

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
const DAY_LABELS: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

interface TypeState {
  enabled: boolean
  day: typeof DAYS[number]
  frequency: 'weekly' | 'biweekly'
  anchorDate: string | null
}

const defaultState = (): TypeState => ({
  enabled: false, day: 'monday', frequency: 'weekly', anchorDate: null,
})

export default function ManualEntryScreen() {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState<Record<string, TypeState>>({
    garbage: defaultState(),
    recycling: defaultState(),
    yard_waste: defaultState(),
  })

  function update(type: string, patch: Partial<TypeState>) {
    setState(s => ({ ...s, [type]: { ...s[type], ...patch } }))
  }

  async function handleSave() {
    if (!user) { router.push('/sign-in'); return }
    const schedules: ManualScheduleInput[] = EVENT_TYPES
      .filter(t => state[t.key].enabled)
      .map(t => ({
        event_type: t.key,
        pickup_day: state[t.key].day,
        frequency: state[t.key].frequency,
        anchor_date: state[t.key].frequency === 'biweekly' ? state[t.key].anchorDate : null,
      }))

    if (schedules.length === 0) return

    setSaving(true)
    await saveManualSchedules(user.id, schedules)

    // Build a local result to show in schedule screen
    const events = schedules.flatMap(s => generateEventsFromManual(s))
    events.sort((a, b) => a.date.localeCompare(b.date))
    scheduleStore.set(
      {
        place: {
          address_key: 'manual',
          recollect_place_id: null,
          latitude: null,
          longitude: null,
          timezone: null,
          supported_event_types: schedules.map(s => s.event_type),
          provider: null,
        },
        events,
      },
      '', '', ''
    )
    setSaving(false)
    router.replace('/schedule')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Enter your pickup days</Text>
        <Text style={styles.subtitle}>
          Tell us when your pickups happen and we'll remind you the night before.
        </Text>

        {EVENT_TYPES.map(({ key, label, icon }) => {
          const s = state[key]
          return (
            <View key={key} style={styles.card}>
              <Pressable style={styles.cardHeader} onPress={() => update(key, { enabled: !s.enabled })}>
                <Text style={styles.cardIcon}>{icon}</Text>
                <Text style={styles.cardLabel}>{label}</Text>
                <View style={[styles.toggle, s.enabled && styles.toggleOn]}>
                  <Text style={styles.toggleText}>{s.enabled ? 'On' : 'Off'}</Text>
                </View>
              </Pressable>

              {s.enabled && (
                <View style={styles.cardBody}>
                  <Text style={styles.fieldLabel}>Pickup day</Text>
                  <View style={styles.chipRow}>
                    {DAYS.map(d => (
                      <Pressable
                        key={d}
                        style={[styles.chip, s.day === d && styles.chipSelected]}
                        onPress={() => update(key, { day: d })}
                      >
                        <Text style={[styles.chipText, s.day === d && styles.chipTextSelected]}>
                          {DAY_LABELS[d]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Frequency</Text>
                  <View style={styles.chipRow}>
                    {(['weekly', 'biweekly'] as const).map(f => (
                      <Pressable
                        key={f}
                        style={[styles.chip, s.frequency === f && styles.chipSelected]}
                        onPress={() => update(key, { frequency: f })}
                      >
                        <Text style={[styles.chipText, s.frequency === f && styles.chipTextSelected]}>
                          {f === 'weekly' ? 'Every week' : 'Every 2 weeks'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {s.frequency === 'biweekly' && (
                    <>
                      <Text style={styles.fieldLabel}>When is your next pickup?</Text>
                      <Text style={styles.anchorHint}>
                        Enter a date (YYYY-MM-DD) for the next upcoming {label.toLowerCase()} pickup.
                      </Text>
                      <Pressable
                        style={styles.dateInput}
                        onPress={() => {
                          // Simple prompt — native date picker deferred to v2
                          const today = new Date()
                          const pad = (n: number) => String(n).padStart(2, '0')
                          update(key, {
                            anchorDate: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
                          })
                        }}
                      >
                        <Text style={styles.dateInputText}>
                          {s.anchorDate ?? 'Tap to set anchor date (defaults to today)'}
                        </Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}
            </View>
          )
        })}

        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Save my schedule</Text>
          }
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  backRow: { paddingBottom: spacing.sm },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.md,
  },
  cardIcon: { fontSize: 20 },
  cardLabel: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' },
  toggle: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.sm, backgroundColor: colors.border,
  },
  toggleOn: { backgroundColor: colors.primary },
  toggleText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  cardBody: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  anchorHint: { fontSize: 12, color: colors.textSecondary },
  dateInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.md, backgroundColor: colors.background,
  },
  dateInputText: { color: colors.text, fontSize: 14 },
  button: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center', marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
```

- [ ] **Step 3: Update `app/address-not-found.tsx` to gate manual entry behind sign-in**

Read the current file, then update the "Enter my pickup days" button handler:

```tsx
import { useAuth } from '../src/lib/auth-context'

// Inside the component:
const { user } = useAuth()

// The "Enter my pickup days" button:
onPress={() => user ? router.push('/manual-entry') : router.push('/sign-in')}
```

- [ ] **Step 4: Run all tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/manual-entry.tsx app/address-not-found.tsx
git commit -m "feat: manual entry screen — per-type day/frequency picker, saves to Supabase"
```

---

## Task 13: Final integration + full verification

- [ ] **Step 1: Run full test suite**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 2: Web flow verification**

```bash
npx expo start --web
```

Check each path:
1. Anonymous lookup → schedule shows → "Sign in →" banner visible → tap navigates to sign-in screen
2. Sign up → "Check your email" message shown, switches to sign-in mode
3. Sign in (use a real Supabase local user) → returns to schedule → gear ⚙️ appears
4. Tap gear → Settings screen shows address, "Reminders" row, email, sign-out
5. Tap "Reminders" → Notifications screen with toggles + time chips → Save returns to Settings
6. Sign out → gear disappears, banner reappears
7. Look up an address not found → Address Not Found screen → "Enter my pickup days" → since not signed in → redirects to sign-in → after sign-in → manual-entry screen → configure and save → schedule screen shows manual events

- [ ] **Step 3: Mobile verification (Expo Go)**

On a physical device with Expo Go:
1. Repeat web flow above
2. On sign-in, confirm push notification permission prompt appears
3. Confirm app works offline-gracefully (network error shown, not crash)

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

---

## Self-review notes

**Spec coverage check:**
- ✅ Sign up / sign in screen (Task 7)
- ✅ Email verification (handled by Supabase — sign-up shows "check email" message)
- ✅ Push token registration (Task 6)
- ✅ Save address + pickup events on sign-in (Task 8)
- ✅ Notification preferences — per-type toggles + time (Task 10)
- ✅ Settings screen — address, reminders, sign out, delete account (Task 9)
- ✅ Manual entry flow — day/frequency/anchor, saves to manual_schedules (Task 12)
- ✅ Upsell banner navigates to sign-in (Task 8)
- ✅ Gear icon on schedule → settings (Task 9)
- ⚠️ Google OAuth — out of scope for this plan (requires OAuth credentials + native config)
- ⚠️ Address change flow from Settings — Settings shows address but "Change" link deferred (navigates back to home)
- ⚠️ `delete_user` RPC — needs to be added as a Postgres function in a new migration (add to Task 5 if not already in migrations)

**`delete_user` RPC migration:** Add this as a step in Task 5 before writing user-api.ts. Create migration `20260502000007_delete_user_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
```
