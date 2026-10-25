# Local-First, No Sign-In Wall — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the sign-in wall. Saving an address and viewing its schedule work entirely on-device, with no account. Turning on push reminders is the only action that creates a (passwordless, anonymous) Supabase account.

**Architecture:** A new local-storage module (`saved-address.ts`) becomes the source of truth for "my address" everywhere the app currently reads from `user_preferences`. A new `enable-reminders.ts` module is the single choke point that lazily creates an anonymous Supabase session and pushes the local address up to the existing (unchanged) backend. Email/password auth is deleted outright.

**Tech Stack:** Expo Router, React Native, `@supabase/supabase-js` (`signInAnonymously`), `@react-native-async-storage/async-storage` (already a dependency; already mocked in `jest.config.js` via `moduleNameMapper`), Jest + `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-10-25-anonymous-local-first.md`

## Global Constraints

- No email/password auth anywhere — `supabase.auth.signUp` / `signInWithPassword` must not appear in `src/` or `app/` after this plan.
- Zero changes to `supabase/` (migrations, RLS, Edge Functions, cron). Every existing backend function signature (`saveAddress`, `savePickupEvents`, `saveManualSchedules`, `getPreferences`, `deleteAccount`, `registerPushToken`) stays as-is; only new call sites are added.
- Local persistence uses `@react-native-async-storage/async-storage` directly (no `Platform.OS` branching) — the package already supports web.
- After every task, run `npm test` (`jest --watchAll=false`) and confirm the full suite is green before committing. Never leave the suite red between tasks.
- Follow existing file conventions: `StyleSheet.create` at the bottom of each component, `colors`/`spacing`/`radius` from `src/constants/theme`, test files colocated and named `<file>.test.ts(x)`.

---

## Task 1: `src/lib/saved-address.ts` — local persistence for the saved address

**Files:**
- Create: `src/lib/saved-address.ts`
- Test: `src/lib/saved-address.test.ts`

**Interfaces:**
- Produces: `SavedAddress` interface `{ street: string; city: string; state: string; place: PlaceInfo; events: PickupEvent[]; manualSchedules?: ManualScheduleInput[]; savedAt: string }`; `SaveAddressInput = Omit<SavedAddress, 'savedAt'>`; `getSavedAddress(): Promise<SavedAddress | null>`; `saveAddressLocally(input: SaveAddressInput): Promise<void>`; `clearSavedAddress(): Promise<void>`; `isStale(savedAt: string): boolean`; `SAVED_ADDRESS_STALE_MS: number`; `STORAGE_KEY: string`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/saved-address.test.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getSavedAddress, saveAddressLocally, clearSavedAddress, isStale,
  SAVED_ADDRESS_STALE_MS, STORAGE_KEY,
} from './saved-address'
import { PlaceInfo, PickupEvent, ManualScheduleInput } from './types'

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

beforeEach(async () => {
  await AsyncStorage.clear()
})

it('returns null when nothing is saved', async () => {
  expect(await getSavedAddress()).toBeNull()
})

it('saves and retrieves an address', async () => {
  await saveAddressLocally({ street: '1 Main St', city: 'Mahwah', state: 'NJ', place, events })
  const saved = await getSavedAddress()
  expect(saved?.street).toBe('1 Main St')
  expect(saved?.city).toBe('Mahwah')
  expect(saved?.state).toBe('NJ')
  expect(saved?.place).toEqual(place)
  expect(saved?.events).toEqual(events)
  expect(typeof saved?.savedAt).toBe('string')
})

it('clears the saved address', async () => {
  await saveAddressLocally({ street: '1 Main St', city: 'Mahwah', state: 'NJ', place, events })
  await clearSavedAddress()
  expect(await getSavedAddress()).toBeNull()
})

it('returns null when stored JSON is corrupted', async () => {
  await AsyncStorage.setItem(STORAGE_KEY, 'not json')
  expect(await getSavedAddress()).toBeNull()
})

it('round-trips manualSchedules when present', async () => {
  const manualSchedules: ManualScheduleInput[] = [
    { event_type: 'garbage', pickup_day: 'monday', frequency: 'weekly', anchor_date: null },
  ]
  await saveAddressLocally({ street: 'manual', city: '', state: '', place, events, manualSchedules })
  const saved = await getSavedAddress()
  expect(saved?.manualSchedules).toEqual(manualSchedules)
})

it('isStale returns false for a timestamp saved just now', () => {
  expect(isStale(new Date().toISOString())).toBe(false)
})

it('isStale returns true for a timestamp older than the stale window', () => {
  const old = new Date(Date.now() - SAVED_ADDRESS_STALE_MS - 1000).toISOString()
  expect(isStale(old)).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/saved-address.test.ts`
Expected: FAIL with "Cannot find module './saved-address'"

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/saved-address.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PlaceInfo, PickupEvent, ManualScheduleInput } from './types'

export const STORAGE_KEY = 'whenismy.savedAddress'
// Matches the 24h cache window the lookup-schedule Edge Function already uses.
export const SAVED_ADDRESS_STALE_MS = 24 * 60 * 60 * 1000

export interface SavedAddress {
  street: string
  city: string
  state: string
  place: PlaceInfo
  events: PickupEvent[]
  manualSchedules?: ManualScheduleInput[]
  savedAt: string
}

export type SaveAddressInput = Omit<SavedAddress, 'savedAt'>

export async function getSavedAddress(): Promise<SavedAddress | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SavedAddress
  } catch {
    return null
  }
}

export async function saveAddressLocally(input: SaveAddressInput): Promise<void> {
  const record: SavedAddress = { ...input, savedAt: new Date().toISOString() }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(record))
}

export async function clearSavedAddress(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY)
}

export function isStale(savedAt: string): boolean {
  return Date.now() - new Date(savedAt).getTime() > SAVED_ADDRESS_STALE_MS
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/saved-address.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/saved-address.ts src/lib/saved-address.test.ts
git commit -m "feat: add local persistence for the saved address

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Remove email/password screens

**Files:**
- Delete: `app/sign-in.tsx`, `app/sign-in.test.tsx`
- Delete: `app/check-email.tsx`
- Delete: `app/change-password.tsx`, `app/change-password.test.tsx`
- Modify: `app/_layout.tsx`

**Interfaces:** None — this task only removes dead UI. `src/lib/auth.ts` (`signUp`/`signIn`/`changePassword`) is rewritten in Task 3, after these are the only files that stop importing them.

- [ ] **Step 1: Delete the screen files and their tests**

```bash
git rm app/sign-in.tsx app/sign-in.test.tsx app/check-email.tsx app/change-password.tsx app/change-password.test.tsx
```

- [ ] **Step 2: Remove their routes from the root layout**

In `app/_layout.tsx`, remove these three lines:

```tsx
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="check-email" />
```

and (further down, after `calendar-url`):

```tsx
        <Stack.Screen name="change-password" />
```

The file should read:

```tsx
import { Stack } from 'expo-router'
import { AuthProvider } from '../src/lib/auth-context'

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="schedule" />
        <Stack.Screen name="address-not-found" />
        <Stack.Screen name="calendar-url" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="manual-entry" />
      </Stack>
    </AuthProvider>
  )
}
```

(Note: `app/(tabs)/account.tsx` still has a dangling `router.push('/change-password')` call at this point — that's fixed in Task 12. It's a harmless dead link in a mocked-router test until then, not a compile error.)

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — the suite now has 3 fewer test files; nothing else references the deleted screens yet.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove email/password sign-in, check-email, and change-password screens

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: Rewrite `src/lib/auth.ts` — drop password auth, add anonymous sign-in

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/auth.test.ts`

**Interfaces:**
- Consumes: `supabase.auth.signOut()`, `supabase.auth.getSession()`, `supabase.auth.signInAnonymously()` (all from `./supabase`, already present in `@supabase/supabase-js@^2.45.0`).
- Produces: `signOut(): Promise<{ error: any }>`; `getSession(): Promise<Session | null>`; `ensureAnonymousUser(): Promise<string>` — returns the current session's user id, creating an anonymous session first if none exists.

- [ ] **Step 1: Write the failing test**

Replace `src/lib/auth.test.ts` entirely:

```ts
import { supabase } from './supabase'
import { signOut, getSession, ensureAnonymousUser } from './auth'

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
      getSession: jest.fn(),
      signInAnonymously: jest.fn(),
    },
  },
}))

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>

beforeEach(() => jest.clearAllMocks())

it('signOut calls supabase.auth.signOut', async () => {
  mockAuth.signOut.mockResolvedValueOnce({ error: null } as any)
  await signOut()
  expect(mockAuth.signOut).toHaveBeenCalled()
})

it('getSession returns the current session', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null } as any)
  const session = await getSession()
  expect(session?.user.id).toBe('u1')
})

it('ensureAnonymousUser returns the existing session user id without signing in again', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null } as any)
  const id = await ensureAnonymousUser()
  expect(id).toBe('u1')
  expect(mockAuth.signInAnonymously).not.toHaveBeenCalled()
})

it('ensureAnonymousUser signs in anonymously when there is no session', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any)
  mockAuth.signInAnonymously.mockResolvedValueOnce({ data: { user: { id: 'u2' }, session: {} }, error: null } as any)
  const id = await ensureAnonymousUser()
  expect(id).toBe('u2')
  expect(mockAuth.signInAnonymously).toHaveBeenCalledTimes(1)
})

it('ensureAnonymousUser throws when signInAnonymously fails', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any)
  mockAuth.signInAnonymously.mockResolvedValueOnce({
    data: { user: null, session: null },
    error: { message: 'network error' },
  } as any)
  await expect(ensureAnonymousUser()).rejects.toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/auth.test.ts`
Expected: FAIL — `ensureAnonymousUser` is not exported (old `auth.ts` only has `signUp`/`signIn`/`signOut`/`getSession`/`changePassword`).

- [ ] **Step 3: Write minimal implementation**

Replace `src/lib/auth.ts` entirely:

```ts
import { supabase } from './supabase'

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// The only entry point into a Supabase account. Returns the existing
// session's user id if one exists, otherwise creates an anonymous session
// (no email, no password) and returns its user id.
export async function ensureAnonymousUser(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user) return data.session.user.id

  const { data: signInData, error } = await supabase.auth.signInAnonymously()
  if (error || !signInData.user) {
    throw error ?? new Error('Failed to create anonymous session')
  }
  return signInData.user.id
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/auth.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/lib/auth.test.ts
git commit -m "feat: replace password auth with ensureAnonymousUser

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: Simplify `src/lib/auth-context.tsx` — drop email-confirmation deep links

**Files:**
- Modify: `src/lib/auth-context.tsx`

**Interfaces:**
- Produces (unchanged): `AuthProvider`, `useAuth(): { user: User | null; session: Session | null; loading: boolean }`.

There is no dedicated test file for this module (confirmed: no `auth-context.test.tsx` exists). Verification is the full suite plus the manual check in Step 2.

- [ ] **Step 1: Remove the deep-link handling block**

Replace `src/lib/auth-context.tsx` entirely:

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { registerPushToken } from './push-notifications'

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
      if (s?.user) registerPushToken(s.user.id)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
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

This drops the `expo-linking` import, the `handleDeepLink` function, and both `Linking` listeners — there's no more email sign-up to confirm via deep link. `user`/`session`/`loading` keep the exact same shape every other screen already consumes.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — every screen that mocks `useAuth` (`account.tsx`-style mocks) is unaffected since the context's public shape didn't change.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth-context.tsx
git commit -m "refactor: drop email-confirmation deep-link handling from AuthProvider

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `src/lib/enable-reminders.ts` — the one path that creates a cloud account

**Files:**
- Create: `src/lib/enable-reminders.ts`
- Test: `src/lib/enable-reminders.test.ts`

**Interfaces:**
- Consumes: `ensureAnonymousUser(): Promise<string>` (`./auth`, Task 3); `saveAddress(userId, street, city, state, place): Promise<any>` and `savePickupEvents(userId, events): Promise<any>` (`./user-api`, unchanged); `saveManualSchedules(userId, schedules): Promise<any>` (`./manual-schedule`, unchanged); `registerPushToken(userId): Promise<void>` (`./push-notifications`, unchanged).
- Produces: `enableRemindersForAddress(street: string, city: string, state: string, place: PlaceInfo, events: PickupEvent[]): Promise<void>`; `enableRemindersForManualSchedule(schedules: ManualScheduleInput[]): Promise<void>`. Both throw if any step fails — callers are responsible for catching and showing an error.

- [ ] **Step 1: Write the failing test**

Create `src/lib/enable-reminders.test.ts`:

```ts
import { ensureAnonymousUser } from './auth'
import { saveAddress, savePickupEvents } from './user-api'
import { saveManualSchedules } from './manual-schedule'
import { registerPushToken } from './push-notifications'
import { enableRemindersForAddress, enableRemindersForManualSchedule } from './enable-reminders'
import { PlaceInfo, PickupEvent, ManualScheduleInput } from './types'

jest.mock('./auth', () => ({ ensureAnonymousUser: jest.fn() }))
jest.mock('./user-api', () => ({ saveAddress: jest.fn(), savePickupEvents: jest.fn() }))
jest.mock('./manual-schedule', () => ({ saveManualSchedules: jest.fn() }))
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/enable-reminders.test.ts`
Expected: FAIL with "Cannot find module './enable-reminders'"

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/enable-reminders.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/enable-reminders.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/enable-reminders.ts src/lib/enable-reminders.test.ts
git commit -m "feat: add enable-reminders — the sole trigger for creating a cloud account

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: `SaveAddressBanner` — local-only save, no account required

**Files:**
- Modify: `src/components/SaveAddressBanner.tsx`
- Modify: `src/components/SaveAddressBanner.test.tsx`

**Interfaces:**
- Consumes: `saveAddressLocally(input: SaveAddressInput): Promise<void>` (Task 1); `enableRemindersForAddress(...)` (Task 5).
- Produces: `SaveAddressBanner` props become `{ street: string; city: string; state: string; place: PlaceInfo; events: PickupEvent[]; isSaved: boolean }` — **`userId` is removed.**

- [ ] **Step 1: Write the failing test**

Replace `src/components/SaveAddressBanner.test.tsx` entirely:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { SaveAddressBanner } from './SaveAddressBanner'

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}))

jest.mock('../lib/saved-address', () => ({
  saveAddressLocally: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../lib/enable-reminders', () => ({
  enableRemindersForAddress: jest.fn().mockResolvedValue(undefined),
}))

const mockPlace = {
  address_key: 'test',
  recollect_place_id: null,
  latitude: null,
  longitude: null,
  timezone: null,
  supported_event_types: ['garbage'],
  provider: null as null,
}

const mockEvents = [{ date: '2026-06-01', event_type: 'garbage' }]

function renderBanner(isSaved: boolean) {
  return render(
    <SaveAddressBanner
      street="1 Main St"
      city="Mahwah"
      state="NJ"
      place={mockPlace}
      events={mockEvents}
      isSaved={isSaved}
    />
  )
}

beforeEach(() => jest.clearAllMocks())

describe('SaveAddressBanner', () => {
  it('renders when isSaved is false', () => {
    const { getByText } = renderBanner(false)
    expect(getByText(/Save as my address/i)).toBeTruthy()
  })

  it('renders nothing when isSaved is true', () => {
    const { queryByText } = renderBanner(true)
    expect(queryByText(/Save as my address/i)).toBeNull()
  })

  it('shows confirmation after tapping Save', async () => {
    const { getByText } = renderBanner(false)
    fireEvent.press(getByText('Save'))
    await waitFor(() => {
      expect(getByText(/Address saved/i)).toBeTruthy()
    })
  })

  it('saves locally with the given street, city, state, place, and events', async () => {
    const { saveAddressLocally } = require('../lib/saved-address')
    const { getByText } = renderBanner(false)
    fireEvent.press(getByText('Save'))
    await waitFor(() => {
      expect(saveAddressLocally).toHaveBeenCalledWith({
        street: '1 Main St', city: 'Mahwah', state: 'NJ',
        place: mockPlace, events: mockEvents,
      })
    })
  })

  it('tapping the saved confirmation turns on reminders and navigates to /notifications', async () => {
    const { enableRemindersForAddress } = require('../lib/enable-reminders')
    const { router } = require('expo-router')
    const { getByText } = renderBanner(false)
    fireEvent.press(getByText('Save'))
    const confirmation = await waitFor(() => getByText(/Address saved/i))
    fireEvent.press(confirmation)
    await waitFor(() => {
      expect(enableRemindersForAddress).toHaveBeenCalledWith(
        '1 Main St', 'Mahwah', 'NJ', mockPlace, mockEvents
      )
      expect(router.push).toHaveBeenCalledWith('/notifications')
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/SaveAddressBanner.test.tsx`
Expected: FAIL — current component still requires a `userId` prop and imports `saveAddress`/`savePickupEvents` from `../lib/user-api`, not `../lib/saved-address`.

- [ ] **Step 3: Write minimal implementation**

Replace `src/components/SaveAddressBanner.tsx` entirely:

```tsx
import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { PlaceInfo, PickupEvent } from '../lib/types'
import { saveAddressLocally } from '../lib/saved-address'
import { enableRemindersForAddress } from '../lib/enable-reminders'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  street: string
  city: string
  state: string
  place: PlaceInfo
  events: PickupEvent[]
  isSaved: boolean
}

export function SaveAddressBanner({ street, city, state, place, events, isSaved }: Props) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (isSaved) return null

  async function handleSetUpReminders() {
    setEnabling(true)
    try {
      await enableRemindersForAddress(street, city, state, place, events)
      router.push('/notifications')
    } catch {
      Alert.alert('Error', 'Could not turn on reminders. Please try again.')
    } finally {
      setEnabling(false)
    }
  }

  if (saved) {
    return (
      <Pressable
        style={[styles.banner, styles.bannerSaved]}
        onPress={handleSetUpReminders}
        disabled={enabling}
        accessibilityRole="button"
      >
        <Text style={styles.savedText}>
          {enabling ? 'Turning on reminders…' : '✓ Address saved — set up reminders →'}
        </Text>
      </Pressable>
    )
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await saveAddressLocally({ street, city, state, place, events })
      setSaved(true)
    } catch {
      setSaveError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.banner}>
      <View style={styles.bannerLeft}>
        <Text style={styles.bannerIcon}>📍</Text>
        <Text style={styles.bannerText}>Save as my address</Text>
      </View>
      <Pressable
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.saveButtonText}>Save</Text>
        }
      </Pressable>
      {saveError && <Text style={styles.errorText}>{saveError}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  bannerSaved: {
    borderColor: '#10B981',
    justifyContent: 'center',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  bannerIcon: { fontSize: 18 },
  bannerText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 56,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  savedText: { fontSize: 14, color: '#10B981', fontWeight: '500' },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4 },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/SaveAddressBanner.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/SaveAddressBanner.tsx src/components/SaveAddressBanner.test.tsx
git commit -m "feat: SaveAddressBanner saves locally with no account required

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7: `ScheduleContent` — drop the sign-in gate on saving and on the reminders upsell

**Files:**
- Modify: `src/components/ScheduleContent.tsx`
- Test: `src/components/ScheduleContent.test.tsx` (new — no test file existed for this component before)

**Interfaces:**
- Consumes: `SaveAddressBanner` (Task 6, no `userId` prop); `saveAddressLocally` (Task 1); `enableRemindersForAddress` (Task 5).
- Produces (unchanged): `ScheduleContent` props `{ result, onBack, address?, showBack?, savedAddress? }`.

This is the file the brainstorming spec's file list missed: today it has `{user && !isCurrentAddressSaved && <SaveAddressBanner userId={user.id} .../>}` — the actual sign-in gate on saving — plus an upsell banner linking to `/sign-in`. Both are fixed here.

- [ ] **Step 1: Write the failing test**

Create `src/components/ScheduleContent.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { ScheduleContent } from './ScheduleContent'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}))

const mockUseAuth = jest.fn()
jest.mock('../lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('../lib/holidays', () => ({
  getUSHolidays: jest.fn().mockResolvedValue(new Map()),
  todayHolidayNote: jest.fn().mockReturnValue(undefined),
}))

jest.mock('../lib/saved-address', () => ({
  saveAddressLocally: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../lib/enable-reminders', () => ({
  enableRemindersForAddress: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./NextPickupCard', () => ({ NextPickupCard: () => null }))
jest.mock('./ScheduleList', () => ({ ScheduleList: () => null }))
jest.mock('./PickupCalendar', () => ({ PickupCalendar: () => null }))

const place = {
  address_key: '1 main st|mahwah|nj',
  recollect_place_id: 'p1',
  latitude: 40.9,
  longitude: -74.1,
  timezone: 'America/New_York',
  supported_event_types: ['garbage'],
  provider: 'recollect' as const,
}
const events = [{ date: '2026-06-01', event_type: 'garbage' }]
const result = { place, events }

beforeEach(() => {
  jest.clearAllMocks()
  mockUseAuth.mockReturnValue({ user: null, session: null, loading: false })
})

it('shows the Save banner when the address is not saved, with no account required', async () => {
  const { findByText } = render(<ScheduleContent result={result} onBack={jest.fn()} />)
  expect(await findByText('Save as my address')).toBeTruthy()
})

it('hides the Save banner once the address matches savedAddress', async () => {
  const { queryByText, findByText } = render(
    <ScheduleContent
      result={result}
      onBack={jest.fn()}
      savedAddress={{ street: '1 main st', city: 'mahwah', state: 'nj' }}
    />
  )
  await findByText(/Get reminders/i)
  expect(queryByText('Save as my address')).toBeNull()
})

it('shows the "Get reminders" upsell when there is no reminders account', async () => {
  const { findByText } = render(<ScheduleContent result={result} onBack={jest.fn()} />)
  expect(await findByText('Get reminders the night before pickup →')).toBeTruthy()
})

it('hides the "Get reminders" upsell once a reminders account exists', async () => {
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, session: {}, loading: false })
  const { queryByText, findByText } = render(<ScheduleContent result={result} onBack={jest.fn()} />)
  await findByText('Save as my address')
  expect(queryByText(/Get reminders/i)).toBeNull()
})

it('tapping "Get reminders" saves locally, enables reminders, and navigates to /notifications', async () => {
  const { saveAddressLocally } = require('../lib/saved-address')
  const { enableRemindersForAddress } = require('../lib/enable-reminders')
  const { router } = require('expo-router')
  const { findByText } = render(<ScheduleContent result={result} onBack={jest.fn()} />)
  const upsell = await findByText('Get reminders the night before pickup →')
  fireEvent.press(upsell)
  await waitFor(() => {
    expect(saveAddressLocally).toHaveBeenCalledWith({
      street: '1 main st', city: 'mahwah', state: 'nj', place, events,
    })
    expect(enableRemindersForAddress).toHaveBeenCalledWith('1 main st', 'mahwah', 'nj', place, events)
    expect(router.push).toHaveBeenCalledWith('/notifications')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ScheduleContent.test.tsx`
Expected: FAIL — the current component only shows `SaveAddressBanner` when `user` is truthy, and the upsell banner navigates to `/sign-in` instead of calling `enableRemindersForAddress`.

- [ ] **Step 3: Write minimal implementation**

In `src/components/ScheduleContent.tsx`:

1. Update the `react-native` import to add `Alert`:

```tsx
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions, Platform, Alert } from 'react-native'
```

2. Add two new imports below the existing `SaveAddressBanner` import:

```tsx
import { saveAddressLocally } from '../lib/saved-address'
import { enableRemindersForAddress } from '../lib/enable-reminders'
```

3. Inside `ScheduleContent`, add an `enablingReminders` state and a handler, right after the `isCurrentAddressSaved` computation:

```tsx
  const [enablingReminders, setEnablingReminders] = useState(false)

  async function handleEnableReminders() {
    setEnablingReminders(true)
    try {
      await saveAddressLocally({ street: addrStreet, city: addrCity, state: addrState, place, events })
      await enableRemindersForAddress(addrStreet, addrCity, addrState, place, events)
      router.push('/notifications')
    } catch {
      Alert.alert('Error', 'Could not turn on reminders. Please try again.')
    } finally {
      setEnablingReminders(false)
    }
  }
```

(Place the `useState` call with the other `useState` calls near the top of the component, and the `handleEnableReminders` function after `isCurrentAddressSaved` is computed — it closes over `addrStreet`/`addrCity`/`addrState`.)

4. Replace the `SaveAddressBanner` render block:

```tsx
      {!isCurrentAddressSaved && (
        <SaveAddressBanner
          street={addrStreet}
          city={addrCity}
          state={addrState}
          place={place}
          events={events}
          isSaved={false}
        />
      )}
```

5. Replace the upsell banner at the bottom:

```tsx
      {!user && Platform.OS !== 'web' && (
        <Pressable
          style={styles.upsellBanner}
          onPress={handleEnableReminders}
          disabled={enablingReminders}
          accessibilityRole="button"
        >
          <Text style={styles.upsellText}>
            {enablingReminders ? 'Turning on reminders…' : 'Get reminders the night before pickup →'}
          </Text>
        </Pressable>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/components/ScheduleContent.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ScheduleContent.tsx src/components/ScheduleContent.test.tsx
git commit -m "fix: remove sign-in gate from ScheduleContent's save and reminders CTAs

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 8: `app/index.tsx` — redirect on a locally saved address, not a session

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/index.test.tsx`

**Interfaces:**
- Consumes: `getSavedAddress()` (Task 1).
- Produces (unchanged): default-exported `HomeScreen`.

- [ ] **Step 1: Write the failing test**

Replace `app/index.test.tsx` entirely:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import HomeScreen from './index'
import * as api from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'
import { getSavedAddress } from '../src/lib/saved-address'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native')
    return <Text testID="redirect">{href}</Text>
  },
}))

jest.mock('../src/lib/saved-address', () => ({
  getSavedAddress: jest.fn(),
}))

jest.mock('../src/lib/use-split-layout', () => ({
  useSplitLayout: jest.fn().mockReturnValue(false),
}))

jest.spyOn(api, 'lookupSchedule')

const mockResult = {
  place: {
    address_key: '123 main|springfield|ny',
    recollect_place_id: 'place-1',
    latitude: 40.7,
    longitude: -74.0,
    timezone: 'America/New_York',
    supported_event_types: ['garbage'],
    provider: 'recollect' as const,
  },
  events: [{ date: '2026-04-28', event_type: 'garbage' }],
}

beforeEach(() => {
  jest.clearAllMocks()
  scheduleStore.clear()
  ;(getSavedAddress as jest.Mock).mockResolvedValue(null)
  const { useSplitLayout } = require('../src/lib/use-split-layout')
  useSplitLayout.mockReturnValue(false)
})

it('redirects to the schedule tab when an address is already saved locally', async () => {
  ;(getSavedAddress as jest.Mock).mockResolvedValue({
    street: '1 Main St', city: 'Mahwah', state: 'NJ',
    place: mockResult.place, events: mockResult.events, savedAt: new Date().toISOString(),
  })
  const { findByTestId } = render(<HomeScreen />)
  expect(await findByTestId('redirect')).toHaveTextContent('/(tabs)/schedule')
})

it('navigates to /schedule and saves result to store on success (narrow)', async () => {
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
  const { findByTestId, getByTestId } = render(<HomeScreen />)
  await findByTestId('input-street')
  fireEvent.changeText(getByTestId('input-street'), '123 Main St')
  fireEvent.changeText(getByTestId('input-city'), 'Springfield')
  // NJ is pre-selected by default
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/schedule')
  })
  expect(scheduleStore.getResult()).toEqual(mockResult)
})

it('shows not-found error inline when address is not found', async () => {
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce({
    error: 'Address not found',
    notFound: true,
  })
  const { findByTestId, getByTestId, findByText } = render(<HomeScreen />)
  await findByTestId('input-street')
  fireEvent.changeText(getByTestId('input-street'), '99 Unknown')
  fireEvent.changeText(getByTestId('input-city'), 'Nowhere')
  fireEvent.press(getByTestId('submit-button'))

  await findByText(/please enter a valid address/i)
  const { router } = require('expo-router')
  expect(router.push).not.toHaveBeenCalledWith('/address-not-found')
})

it('does not navigate on success when in split layout (wide screen)', async () => {
  const { useSplitLayout } = require('../src/lib/use-split-layout')
  useSplitLayout.mockReturnValue(true)
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
  const { findByTestId, getByTestId } = render(<HomeScreen />)
  await findByTestId('input-street')
  fireEvent.changeText(getByTestId('input-street'), '123 Main St')
  fireEvent.changeText(getByTestId('input-city'), 'Springfield')
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    expect(api.lookupSchedule).toHaveBeenCalled()
  })
  const { router } = require('expo-router')
  expect(router.push).not.toHaveBeenCalledWith('/schedule')
  // On wide screens setResult is called directly; scheduleStore is NOT populated
  expect(scheduleStore.getResult()).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/index.test.tsx`
Expected: FAIL — current `HomeScreen` reads `useAuth()`, not `getSavedAddress()`, and there's no `getSavedAddress` mock for it to call.

- [ ] **Step 3: Write minimal implementation**

Replace `app/index.tsx` entirely:

```tsx
import React, { useEffect, useState } from 'react'
import {
  View, Text, SafeAreaView, StyleSheet, Alert,
} from 'react-native'
import { router, Redirect } from 'expo-router'
import { AddressForm } from '../src/components/AddressForm'
import { WimLogo } from '../src/components/WimLogo'
import { AddressMatchPicker } from '../src/components/AddressMatchPicker'
import { SplitLayout } from '../src/components/SplitLayout'
import { SchedulePanel } from '../src/components/SchedulePanel'
import { lookupSchedule, isError } from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'
import { getSavedAddress } from '../src/lib/saved-address'
import { useSplitLayout } from '../src/lib/use-split-layout'
import { PlaceMatch, LookupResponse } from '../src/lib/types'
import { toTitleCase } from '../src/lib/formatting'
import { colors, spacing } from '../src/constants/theme'

export default function HomeScreen() {
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null)
  const [result, setResult] = useState<LookupResponse | null>(null)
  const [address, setAddress] = useState<string | undefined>(undefined)
  const [notFound, setNotFound] = useState(false)
  const [serviceUnavailable, setServiceUnavailable] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const isSplit = useSplitLayout()
  const [checkingSaved, setCheckingSaved] = useState(true)
  const [hasSavedAddress, setHasSavedAddress] = useState(false)

  useEffect(() => {
    getSavedAddress().then(saved => {
      setHasSavedAddress(!!saved)
      setCheckingSaved(false)
    })
  }, [])

  if (checkingSaved) return null
  if (hasSavedAddress) return <Redirect href="/(tabs)/schedule" />

  async function handleLookup(street: string, city: string, state: string) {
    setLoading(true)
    setNotFound(false)
    setServiceUnavailable(false)
    try {
      const res = await lookupSchedule(street, city, state)
      if (isError(res)) {
        if (res.notFound) {
          setNotFound(true)
          setResult(null)
        } else if (res.notCovered) {
          router.push('/address-not-found')
        } else if (res.serviceUnavailable) {
          setServiceUnavailable(true)
          setResult(null)
        } else {
          Alert.alert('Error', res.error)
        }
        return
      }
      if (res.multiple && res.multiple.length >= 1) {
        scheduleStore.set(res, street, city, state)
        setMatches(res.multiple)
        return
      }
      if (isSplit) {
        setResult(res)
        setAddress([toTitleCase(street), toTitleCase(city), state.toUpperCase()].filter(Boolean).join(', '))
      } else {
        scheduleStore.set(res, street, city, state)
        router.push('/schedule')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleMatchSelect(_match: PlaceMatch) {
    setMatches(null)
    if (isSplit) {
      // Plan 2 limitation: the lookup-schedule Edge Function returns events for places[0]
      // regardless of which match the user selects. A proper re-fetch by place ID
      // requires extending the Edge Function to accept a placeId param (Plan 3+).
      const stored = scheduleStore.get()
      if (stored) {
        setResult(stored.result)
        setAddress([toTitleCase(stored.street), toTitleCase(stored.city), stored.state.toUpperCase()].filter(Boolean).join(', '))
      }
    } else {
      router.push('/schedule')
    }
  }

  function handleReset() {
    setResult(null)
    setAddress(undefined)
    setNotFound(false)
    setServiceUnavailable(false)
    setMatches(null)
    setResetKey(k => k + 1)
  }

  const formContent = (
    <>
      <WimLogo titleSize={40} align="center" />
      <Text style={styles.subtitle}>
        Find your garbage and recycling pickup days
      </Text>
      <AddressForm key={resetKey} onSubmit={handleLookup} loading={loading} />
      {notFound && !isSplit && (
        <View style={styles.notFoundBox}>
          <Text style={styles.notFoundText}>
            Please enter a valid address.
          </Text>
        </View>
      )}
      {serviceUnavailable && !isSplit && (
        <View style={styles.notFoundBox}>
          <Text style={styles.notFoundText}>
            Schedule data is temporarily unavailable for this address. Please try again later.
          </Text>
        </View>
      )}
    </>
  )

  if (isSplit) {
    return (
      <>
        <SplitLayout
          form={<View style={styles.formPadding}>{formContent}</View>}
          panel={<SchedulePanel result={result} onReset={handleReset} address={address} notFound={notFound} serviceUnavailable={serviceUnavailable} />}
        />
        {matches && (
          <AddressMatchPicker
            matches={matches}
            onSelect={handleMatchSelect}
            onDismiss={() => setMatches(null)}
          />
        )}
      </>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {formContent}
      </View>
      {matches && (
        <AddressMatchPicker
          matches={matches}
          onSelect={handleMatchSelect}
          onDismiss={() => setMatches(null)}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  formPadding: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  notFoundBox: {
    backgroundColor: '#2a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: 6,
    padding: spacing.md,
  },
  notFoundText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
})
```

Note: `Platform`, the "Have an account? Sign in →" row, and its three styles (`signInRow`, `signInText`, `signInLink`) are dropped — there's no sign-in route to link to anymore.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/index.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/index.tsx app/index.test.tsx
git commit -m "feat: index.tsx redirects on a locally saved address instead of a session

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 9: `app/(tabs)/schedule.tsx` — read from the local store, refresh only when stale

**Files:**
- Modify: `app/(tabs)/schedule.tsx`
- Modify: `app/(tabs)/schedule.test.tsx`
- Modify: `src/lib/user-api.ts` (remove the now-unused `getManualPickupEvents`)

**Interfaces:**
- Consumes: `getSavedAddress()`, `isStale()`, `saveAddressLocally()` (Task 1).
- Produces (unchanged): default-exported `ScheduleTab`.

- [ ] **Step 1: Write the failing test**

Replace `app/(tabs)/schedule.test.tsx` entirely:

```tsx
import React from 'react'
import { ActivityIndicator } from 'react-native'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import ScheduleTab from './schedule'
import { getSavedAddress, isStale, saveAddressLocally } from '../../src/lib/saved-address'
import * as api from '../../src/lib/api'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('../../src/lib/saved-address', () => ({
  getSavedAddress: jest.fn(),
  isStale: jest.fn(),
  saveAddressLocally: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../src/lib/api', () => ({
  lookupSchedule: jest.fn(),
  isError: jest.fn(),
}))

// ScheduleContent is complex — mock it so we can test schedule.tsx in isolation.
jest.mock('../../src/components/ScheduleContent', () => ({
  ScheduleContent: ({ address, showBack, savedAddress }: any) => {
    const { Text, View } = require('react-native')
    return (
      <View>
        <Text testID="schedule-content">{address}</Text>
        {showBack && <Text testID="back-link">back-link</Text>}
        {savedAddress && (
          <Text testID="saved-address">
            {savedAddress.street}|{savedAddress.city}|{savedAddress.state}
          </Text>
        )}
      </View>
    )
  },
}))

const basePlace = {
  address_key: '123 main st|springfield|ny',
  recollect_place_id: 'place-1',
  latitude: 40.7,
  longitude: -74.0,
  timezone: 'America/New_York',
  supported_event_types: ['garbage'],
  provider: 'recollect' as const,
}

const baseEvents = [{ date: '2026-05-10', event_type: 'garbage' }]

const freshSaved = {
  street: '123 main st', city: 'springfield', state: 'ny',
  place: basePlace, events: baseEvents, savedAt: '2026-05-01T00:00:00.000Z',
}

const getSavedAddressMock = getSavedAddress as jest.Mock
const isStaleMock = isStale as jest.Mock
const lookupScheduleMock = api.lookupSchedule as jest.Mock
const isErrorMock = api.isError as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  isErrorMock.mockReturnValue(false)
  isStaleMock.mockReturnValue(false)
})

// 1. Shows ActivityIndicator while the saved address is loading
it('shows ActivityIndicator immediately after mount while data is loading', () => {
  getSavedAddressMock.mockReturnValue(new Promise(() => {})) // never resolves
  const { UNSAFE_getByType } = render(<ScheduleTab />)
  expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
})

// 2. Shows "No address saved yet" when getSavedAddress returns null
it('shows no-address state when getSavedAddress returns null', async () => {
  getSavedAddressMock.mockResolvedValue(null)
  const { getByText } = render(<ScheduleTab />)
  await waitFor(() => expect(getByText('No address saved yet')).toBeTruthy())
  expect(getByText('Go to Search →')).toBeTruthy()
})

// 3. Pressing "Go to Search →" navigates to /(tabs)/search
it('navigates to /(tabs)/search when "Go to Search →" is pressed', async () => {
  getSavedAddressMock.mockResolvedValue(null)
  const { getByText } = render(<ScheduleTab />)
  await waitFor(() => expect(getByText('Go to Search →')).toBeTruthy())
  fireEvent.press(getByText('Go to Search →'))
  const { router } = require('expo-router')
  expect(router.push).toHaveBeenCalledWith('/(tabs)/search')
})

// 4. Renders directly from the local record without calling lookupSchedule when fresh
it('renders ScheduleContent from the local record without calling lookupSchedule when fresh', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  isStaleMock.mockReturnValue(false)
  const { getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('schedule-content')).toBeTruthy())
  expect(lookupScheduleMock).not.toHaveBeenCalled()
})

// 5. Refreshes from lookupSchedule and re-saves locally when the saved record is stale
it('calls lookupSchedule and re-saves locally when the saved record is stale', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  isStaleMock.mockReturnValue(true)
  lookupScheduleMock.mockResolvedValue({ place: basePlace, events: baseEvents })
  const { getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('schedule-content')).toBeTruthy())
  expect(lookupScheduleMock).toHaveBeenCalledWith('123 main st', 'springfield', 'ny')
  expect(saveAddressLocally).toHaveBeenCalledWith({
    street: '123 main st', city: 'springfield', state: 'ny',
    place: basePlace, events: baseEvents,
  })
})

// 6. Shows "Couldn't load schedule" when the stale refresh errors
it('shows error state when the stale refresh returns an error', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  isStaleMock.mockReturnValue(true)
  lookupScheduleMock.mockResolvedValue({ error: 'Service unavailable' })
  isErrorMock.mockReturnValue(true)
  const { getByText } = render(<ScheduleTab />)
  await waitFor(() => expect(getByText("Couldn't load schedule")).toBeTruthy())
  expect(getByText('Service unavailable')).toBeTruthy()
})

// 7. Pressing "Try again" re-triggers load()
it('re-triggers load when "Try again" is pressed', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  isStaleMock.mockReturnValue(true)
  lookupScheduleMock.mockResolvedValue({ error: 'Service unavailable' })
  isErrorMock.mockReturnValue(true)

  const { getByText } = render(<ScheduleTab />)
  await waitFor(() => expect(getByText('Try again')).toBeTruthy())

  lookupScheduleMock.mockResolvedValue({ place: basePlace, events: baseEvents })
  isErrorMock.mockReturnValue(false)

  await act(async () => {
    fireEvent.press(getByText('Try again'))
  })

  expect(getSavedAddressMock).toHaveBeenCalledTimes(2)
  expect(lookupScheduleMock).toHaveBeenCalledTimes(2)
})

// 8. ScheduleContent receives showBack={false}
it('does not render back link (showBack is false)', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  const { queryByTestId, getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('schedule-content')).toBeTruthy())
  expect(queryByTestId('back-link')).toBeNull()
})

// 9. Manually-entered schedules render directly, with no address label, no refresh
it('renders manual schedule events directly, with no address label', async () => {
  getSavedAddressMock.mockResolvedValue({
    street: 'manual', city: '', state: '',
    place: { ...basePlace, address_key: 'manual||', provider: null },
    events: [{ date: '2026-06-02', event_type: 'garbage' }],
    manualSchedules: [{ event_type: 'garbage' as const, pickup_day: 'monday' as const, frequency: 'weekly' as const, anchor_date: null }],
    savedAt: '2026-06-01T00:00:00.000Z',
  })
  const { getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('schedule-content')).toBeTruthy())
  expect(getByTestId('schedule-content').props.children).toBeUndefined()
  expect(lookupScheduleMock).not.toHaveBeenCalled()
})

// 10. ScheduleContent receives savedAddress matching the saved record's street/city/state
it('passes savedAddress with correct street, city, state to ScheduleContent', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  const { getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('saved-address')).toBeTruthy())
  const children = getByTestId('saved-address').props.children
  const text = Array.isArray(children) ? children.join('') : children
  expect(text).toBe('123 main st|springfield|ny')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "app/(tabs)/schedule.test.tsx"`
Expected: FAIL — current `ScheduleTab` reads `useAuth()` + `getPreferences`/`getManualPickupEvents`, not `getSavedAddress`.

- [ ] **Step 3: Write minimal implementation**

Replace `app/(tabs)/schedule.tsx` entirely:

```tsx
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { getSavedAddress, isStale, saveAddressLocally, SavedAddress } from '../../src/lib/saved-address'
import { lookupSchedule, isError } from '../../src/lib/api'
import { ScheduleContent } from '../../src/components/ScheduleContent'
import { LookupResponse } from '../../src/lib/types'
import { toTitleCase } from '../../src/lib/formatting'
import { colors, spacing, radius } from '../../src/constants/theme'

export default function ScheduleTab() {
  const [saved, setSaved] = useState<SavedAddress | null | false>(null) // null=loading, false=none
  const [result, setResult] = useState<LookupResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setSaved(null)
    setLoadError(null)
    setResult(null)

    const addr = await getSavedAddress()
    if (!addr) { setSaved(false); return }
    setSaved(addr)

    // Manual schedules have no live source to refresh against — the
    // locally generated events are the source of truth.
    if (addr.manualSchedules || !isStale(addr.savedAt)) {
      setResult({ place: addr.place, events: addr.events })
      return
    }

    // Refresh from the live source when the local copy is older than the cache window
    const res = await lookupSchedule(addr.street, addr.city, addr.state)
    if (isError(res)) { setLoadError(res.error); return }
    setResult(res)
    await saveAddressLocally({
      street: addr.street, city: addr.city, state: addr.state,
      place: res.place, events: res.events,
    })
  }, [])

  useEffect(() => { load() }, [load])

  // Loading
  if (saved === null) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    )
  }

  // No saved address
  if (saved === false) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyIcon}>📅</Text>
        <Text style={styles.emptyTitle}>No address saved yet</Text>
        <Text style={styles.emptyBody}>
          Search for your pickup schedule and save it to see it here every time.
        </Text>
        <Pressable style={styles.button} onPress={() => router.push('/(tabs)/search')} accessibilityRole="button">
          <Text style={styles.buttonText}>Go to Search →</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  // Load error
  if (loadError || !result) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>Couldn't load schedule</Text>
        <Text style={styles.emptyBody}>{loadError ?? 'Unknown error'}</Text>
        <Pressable style={styles.button} onPress={load} accessibilityRole="button">
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const isManual = !!saved.manualSchedules
  const address = isManual
    ? undefined
    : [toTitleCase(saved.street), toTitleCase(saved.city), saved.state.toUpperCase()].join(', ')

  return (
    <ScheduleContent
      result={result}
      onBack={load}
      address={address}
      showBack={false}
      savedAddress={{ street: saved.street, city: saved.city, state: saved.state }}
    />
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' },
  emptyBody: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
})
```

Then remove the now-unused `getManualPickupEvents` from `src/lib/user-api.ts` (it was only ever called from the old `schedule.tsx`). Delete this block from the end of the file:

```ts
export async function getManualPickupEvents(userId: string): Promise<import('./types').PickupEvent[]> {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('pickup_events')
    .select('event_date, event_type')
    .eq('user_id', userId)
    .eq('source', 'manual')
    .gte('event_date', today)
    .order('event_date')
    .limit(90)
  if (!data) return []
  return data.map(r => ({ date: r.event_date as string, event_type: r.event_type as string }))
}
```

(No test change needed in `user-api.test.ts` — it never had a test for `getManualPickupEvents`.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "app/(tabs)/schedule.test.tsx" src/lib/user-api.test.ts`
Expected: PASS (10 tests + 3 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/schedule.tsx" "app/(tabs)/schedule.test.tsx" src/lib/user-api.ts
git commit -m "feat: Schedule tab reads from the local saved address, not a server account

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 10: `app/manual-entry.tsx` — save locally, no sign-in guard

**Files:**
- Modify: `app/manual-entry.tsx`
- Modify: `app/manual-entry.test.tsx`

**Interfaces:**
- Consumes: `saveAddressLocally()` (Task 1).
- Produces (unchanged): default-exported `ManualEntryScreen`.

- [ ] **Step 1: Write the failing test**

In `app/manual-entry.test.tsx`:

1. Replace the module mocks at the top (remove the `auth-context`, `manual-schedule`'s `saveManualSchedules`, and `schedule-store` mocks; add a `saved-address` mock):

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import ManualEntryScreen from './manual-entry'
import { generateEventsFromManual } from '../src/lib/manual-schedule'
import { saveAddressLocally } from '../src/lib/saved-address'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}))

jest.mock('../src/lib/manual-schedule', () => ({
  generateEventsFromManual: jest
    .fn()
    .mockReturnValue([{ date: '2026-06-02', event_type: 'garbage' }]),
}))

jest.mock('../src/lib/saved-address', () => ({
  saveAddressLocally: jest.fn().mockResolvedValue(undefined),
}))
```

2. Remove `beforeEach(() => { ... (useAuth as jest.Mock).mockReturnValue(...) })` and replace with:

```tsx
beforeEach(() => {
  jest.clearAllMocks()
  ;(generateEventsFromManual as jest.Mock).mockReturnValue([{ date: '2026-06-02', event_type: 'garbage' }])
})
```

3. Replace test `// 8` through the end of the `describe` block (everything from `// 8. Save with nothing enabled` through the end of test `// 12`) with:

```tsx
  // 8. Save with nothing enabled: saveAddressLocally NOT called
  it('does not save when no event types are enabled', async () => {
    const { getByText } = renderScreen()

    fireEvent.press(getByText('Save my schedule'))

    await waitFor(() => {
      expect(saveAddressLocally).not.toHaveBeenCalled()
    })
  })

  // 9. Save with garbage enabled (weekly, Monday): correct call + router.replace
  it('saves locally with correct input and navigates when garbage is enabled', async () => {
    const { getByText } = renderScreen()

    fireEvent.press(getByText('Garbage'))
    // Default day is monday, default frequency is weekly
    fireEvent.press(getByText('Save my schedule'))

    await waitFor(() => {
      expect(saveAddressLocally).toHaveBeenCalledWith({
        street: 'manual',
        city: '',
        state: '',
        place: {
          address_key: 'manual||',
          recollect_place_id: null,
          latitude: null,
          longitude: null,
          timezone: null,
          supported_event_types: ['garbage'],
          provider: null,
        },
        events: [{ date: '2026-06-02', event_type: 'garbage' }],
        manualSchedules: [
          { event_type: 'garbage', pickup_day: 'monday', frequency: 'weekly', anchor_date: null },
        ],
      })
    })

    const { router } = require('expo-router')
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/schedule')
  })

  // 10. "← Back" calls router.back()
  it('calls router.back() when the back link is pressed', () => {
    const { getByText } = renderScreen()
    fireEvent.press(getByText('← Back'))
    const { router } = require('expo-router')
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  // 11. Save failure: shows Alert, does not navigate, spinner clears
  it('shows an error alert and clears the spinner when saving fails', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert')
    ;(saveAddressLocally as jest.Mock).mockRejectedValueOnce(new Error('storage error'))

    const { getByText } = renderScreen()
    fireEvent.press(getByText('Garbage'))
    fireEvent.press(getByText('Save my schedule'))

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not save your schedule. Please try again.')
    })
    const { router } = require('expo-router')
    expect(router.replace).not.toHaveBeenCalled()
    // Button should re-enable (saving=false), so "Save my schedule" text is back
    expect(getByText('Save my schedule')).toBeTruthy()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- app/manual-entry.test.tsx`
Expected: FAIL — current `manual-entry.tsx` still imports `useAuth`/`scheduleStore`/`saveManualSchedules` and guards on `user`.

- [ ] **Step 3: Write minimal implementation**

In `app/manual-entry.tsx`:

1. Replace the imports:

```tsx
import React, { useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { generateEventsFromManual } from '../src/lib/manual-schedule'
import { saveAddressLocally } from '../src/lib/saved-address'
import { ManualScheduleInput } from '../src/lib/types'
import { colors, spacing, radius } from '../src/constants/theme'
```

2. Remove `const { user } = useAuth()` from `ManualEntryScreen`.

3. Replace `handleSave`:

```tsx
  async function handleSave() {
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
    try {
      const events = schedules.flatMap(s => generateEventsFromManual(s))
      events.sort((a, b) => a.date.localeCompare(b.date))
      await saveAddressLocally({
        street: 'manual',
        city: '',
        state: '',
        place: {
          address_key: 'manual||',
          recollect_place_id: null,
          latitude: null,
          longitude: null,
          timezone: null,
          supported_event_types: schedules.map(s => s.event_type),
          provider: null,
        },
        events,
        manualSchedules: schedules,
      })
      router.replace('/(tabs)/schedule')
    } catch {
      Alert.alert('Error', 'Could not save your schedule. Please try again.')
    } finally {
      setSaving(false)
    }
  }
```

Everything else in the file (the JSX, `EVENT_TYPES`, `DAYS`, `DAY_LABELS`, `TypeState`, `defaultState`, styles) is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- app/manual-entry.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/manual-entry.tsx app/manual-entry.test.tsx
git commit -m "feat: manual entry saves locally, no sign-in required

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 11: `app/address-not-found.tsx` — manual entry is always reachable

**Files:**
- Modify: `app/address-not-found.tsx`

**Interfaces:** None — this screen takes no new dependencies.

No test file exists for this screen.

- [ ] **Step 1: Make the edit**

Replace `app/address-not-found.tsx` entirely:

```tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, radius } from '../src/constants/theme'

export default function AddressNotFoundScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Address not found</Text>
        <Text style={styles.body}>
          We couldn't find an automatic schedule for your address. Your city may
          not be in our database yet.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/calendar-url')}
          accessibilityRole="button"
          testID="btn-paste-url"
        >
          <Text style={styles.primaryButtonText}>Paste your calendar URL</Text>
        </Pressable>
        <Text style={styles.orText}>or</Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/manual-entry')}
          accessibilityRole="button"
          testID="btn-manual-entry"
        >
          <Text style={styles.secondaryButtonText}>Enter my pickup days</Text>
        </Pressable>
        <Text style={styles.orText}>or</Text>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          testID="btn-try-again"
        >
          <Text style={styles.secondaryButtonText}>Try a different address</Text>
        </Pressable>
        <Text style={styles.note}>
          You can turn on pickup reminders anytime from the Account tab.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  primaryButton: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  orText: { textAlign: 'center', color: colors.textSecondary, fontSize: 14 },
  secondaryButton: {
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center',
  },
  secondaryButtonText: { color: colors.text, fontSize: 16 },
  note: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
})
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add app/address-not-found.tsx
git commit -m "fix: manual entry is reachable from address-not-found with no sign-in gate

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 12: `app/(tabs)/account.tsx` — address from local store, reminders branch on account, no sign-out

**Files:**
- Modify: `app/(tabs)/account.tsx`
- Modify: `app/(tabs)/account.test.tsx`

**Interfaces:**
- Consumes: `getSavedAddress()`, `clearSavedAddress()` (Task 1); `enableRemindersForAddress()`, `enableRemindersForManualSchedule()` (Task 5).
- Produces (unchanged): default-exported `AccountTab`.

- [ ] **Step 1: Write the failing test**

Replace `app/(tabs)/account.test.tsx` entirely:

```tsx
import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert, ActivityIndicator } from 'react-native'
import AccountTab from './account'
import * as userApi from '../../src/lib/user-api'
import * as auth from '../../src/lib/auth'
import * as savedAddress from '../../src/lib/saved-address'
import * as enableReminders from '../../src/lib/enable-reminders'
import { UserPreferences } from '../../src/lib/types'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}))

const mockUseAuth = jest.fn()
jest.mock('../../src/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('../../src/lib/auth', () => ({
  signOut: jest.fn(),
}))

jest.mock('../../src/lib/user-api', () => ({
  getPreferences: jest.fn(),
  deleteAccount: jest.fn(),
}))

jest.mock('../../src/lib/saved-address', () => ({
  getSavedAddress: jest.fn(),
  clearSavedAddress: jest.fn(),
}))

jest.mock('../../src/lib/enable-reminders', () => ({
  enableRemindersForAddress: jest.fn(),
  enableRemindersForManualSchedule: jest.fn(),
}))

const noAccount = { user: null, session: null, loading: false }
const withAccount = { user: { id: 'user-123' }, session: {}, loading: false }

const savedRecord = {
  street: '123 Main St', city: 'Springfield', state: 'NY',
  place: {
    address_key: '123 main st|springfield|ny', recollect_place_id: 'p1',
    latitude: 40.7, longitude: -74.0, timezone: 'America/New_York',
    supported_event_types: ['garbage'], provider: 'recollect' as const,
  },
  events: [{ date: '2026-06-01', event_type: 'garbage' }],
  savedAt: '2026-06-01T00:00:00.000Z',
}

const manualSavedRecord = {
  ...savedRecord,
  street: 'manual', city: '', state: '',
  manualSchedules: [
    { event_type: 'garbage' as const, pickup_day: 'monday' as const, frequency: 'weekly' as const, anchor_date: null },
  ],
}

const basePrefs: UserPreferences = {
  user_id: 'user-123',
  street: '123 Main St',
  city: 'Springfield',
  state: 'NY',
  recollect_place_id: null,
  latitude: null,
  longitude: null,
  timezone: null,
  notification_time: '20:00',
  notifications_garbage: false,
  notifications_recycling: false,
  notifications_yard_waste: false,
  supported_event_types: [],
}

let alertSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

afterEach(() => {
  alertSpy.mockRestore()
})

async function renderLoaded(opts: {
  auth?: typeof noAccount | typeof withAccount
  saved?: typeof savedRecord | null
  prefs?: UserPreferences | null
} = {}) {
  mockUseAuth.mockReturnValue(opts.auth ?? noAccount)
  ;(savedAddress.getSavedAddress as jest.Mock).mockResolvedValue(opts.saved ?? savedRecord)
  ;(userApi.getPreferences as jest.Mock).mockResolvedValue(opts.prefs ?? basePrefs)

  const utils = render(<AccountTab />)
  await waitFor(() => {
    expect(utils.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
  })
  return utils
}

describe('AccountTab', () => {
  it('shows an activity indicator while the saved address is loading', () => {
    mockUseAuth.mockReturnValue(noAccount)
    ;(savedAddress.getSavedAddress as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { UNSAFE_getByType } = render(<AccountTab />)
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })

  it('shows "None saved" for address when nothing is saved locally', async () => {
    const { getByText } = await renderLoaded({ saved: null })
    expect(getByText('None saved')).toBeTruthy()
  })

  it('shows the formatted address when one is saved locally', async () => {
    const { getByText } = await renderLoaded()
    expect(getByText('123 Main St, Springfield, NY')).toBeTruthy()
  })

  it('shows "Manually entered" for a manual saved address', async () => {
    const { getByText } = await renderLoaded({ saved: manualSavedRecord })
    expect(getByText('Manually entered')).toBeTruthy()
  })

  it('shows "Tap to turn on" for reminders when there is no account', async () => {
    const { getByText } = await renderLoaded({ auth: noAccount })
    expect(getByText('Tap to turn on')).toBeTruthy()
  })

  it('shows "Off" for reminders when an account exists but all notifications are disabled', async () => {
    const { getByText } = await renderLoaded({ auth: withAccount, prefs: basePrefs })
    expect(getByText('Off')).toBeTruthy()
  })

  it('shows active notification types joined with " · " when an account exists', async () => {
    const prefs = { ...basePrefs, notifications_garbage: true, notifications_recycling: true }
    const { getByText } = await renderLoaded({ auth: withAccount, prefs })
    expect(getByText('Garbage · Recycling')).toBeTruthy()
  })

  it('navigates straight to /notifications when an account already exists', async () => {
    const { getByLabelText } = await renderLoaded({ auth: withAccount })
    fireEvent.press(getByLabelText('Reminders settings'))
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/notifications')
    expect(enableReminders.enableRemindersForAddress).not.toHaveBeenCalled()
  })

  it('turns on reminders for a regular address then navigates to /notifications', async () => {
    ;(enableReminders.enableRemindersForAddress as jest.Mock).mockResolvedValue(undefined)
    const { getByLabelText } = await renderLoaded({ auth: noAccount, saved: savedRecord })

    await act(async () => {
      fireEvent.press(getByLabelText('Reminders settings'))
    })

    expect(enableReminders.enableRemindersForAddress).toHaveBeenCalledWith(
      '123 Main St', 'Springfield', 'NY', savedRecord.place, savedRecord.events
    )
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/notifications')
  })

  it('turns on reminders for a manual schedule then navigates to /notifications', async () => {
    ;(enableReminders.enableRemindersForManualSchedule as jest.Mock).mockResolvedValue(undefined)
    const { getByLabelText } = await renderLoaded({ auth: noAccount, saved: manualSavedRecord })

    await act(async () => {
      fireEvent.press(getByLabelText('Reminders settings'))
    })

    expect(enableReminders.enableRemindersForManualSchedule).toHaveBeenCalledWith(
      manualSavedRecord.manualSchedules
    )
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/notifications')
  })

  it('shows an error alert when turning on reminders fails', async () => {
    ;(enableReminders.enableRemindersForAddress as jest.Mock).mockRejectedValue(new Error('network error'))
    const { getByLabelText } = await renderLoaded({ auth: noAccount, saved: savedRecord })

    await act(async () => {
      fireEvent.press(getByLabelText('Reminders settings'))
    })

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not turn on reminders. Please try again.')
    const { router } = require('expo-router')
    expect(router.push).not.toHaveBeenCalledWith('/notifications')
  })

  it('navigates to /(tabs)/search when Address tile is pressed', async () => {
    const { getByLabelText } = await renderLoaded()
    fireEvent.press(getByLabelText('Change saved address'))
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/(tabs)/search')
  })

  it('shows confirmation Alert when "Delete my data" is pressed', async () => {
    const { getByText } = await renderLoaded()
    fireEvent.press(getByText('Delete my data'))
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete my data',
      'This will permanently delete your saved address and reminders. This cannot be undone.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ])
    )
  })

  it('deleting with no account clears local storage only, then navigates to /', async () => {
    const { getByText } = await renderLoaded({ auth: noAccount })
    fireEvent.press(getByText('Delete my data'))

    const buttons = alertSpy.mock.calls[0][2]
    const deleteButton = buttons.find((b: any) => b.text === 'Delete')

    await act(async () => {
      await deleteButton.onPress()
    })

    expect(savedAddress.clearSavedAddress).toHaveBeenCalledTimes(1)
    expect(userApi.deleteAccount).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
    const { router } = require('expo-router')
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('deleting with an account clears local storage, deletes the account, and signs out', async () => {
    ;(userApi.deleteAccount as jest.Mock).mockResolvedValue(undefined)
    ;(auth.signOut as jest.Mock).mockResolvedValue(undefined)
    const { getByText } = await renderLoaded({ auth: withAccount })
    fireEvent.press(getByText('Delete my data'))

    const buttons = alertSpy.mock.calls[0][2]
    const deleteButton = buttons.find((b: any) => b.text === 'Delete')

    await act(async () => {
      await deleteButton.onPress()
    })

    expect(savedAddress.clearSavedAddress).toHaveBeenCalledTimes(1)
    expect(userApi.deleteAccount).toHaveBeenCalledTimes(1)
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    const { router } = require('expo-router')
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('shows an error Alert when deleting fails', async () => {
    ;(userApi.deleteAccount as jest.Mock).mockRejectedValue(new Error('rpc error'))
    const { getByText } = await renderLoaded({ auth: withAccount })
    fireEvent.press(getByText('Delete my data'))

    const buttons = alertSpy.mock.calls[0][2]
    const deleteButton = buttons.find((b: any) => b.text === 'Delete')
    alertSpy.mockClear()

    await act(async () => {
      await deleteButton.onPress()
    })

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not delete your data. Please try again.')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- "app/(tabs)/account.test.tsx"`
Expected: FAIL — current `account.tsx` gates on `user`, shows an email card, has a sign-out row, and navigates straight to `/notifications` regardless of account state.

- [ ] **Step 3: Write minimal implementation**

Replace `app/(tabs)/account.tsx` entirely:

```tsx
import React, { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../../src/lib/auth-context'
import { signOut } from '../../src/lib/auth'
import { getPreferences, deleteAccount } from '../../src/lib/user-api'
import { getSavedAddress, clearSavedAddress, SavedAddress } from '../../src/lib/saved-address'
import { enableRemindersForAddress, enableRemindersForManualSchedule } from '../../src/lib/enable-reminders'
import { UserPreferences } from '../../src/lib/types'
import { colors, spacing, radius } from '../../src/constants/theme'
import { toTitleCase } from '../../src/lib/formatting'

export default function AccountTab() {
  const { user } = useAuth()
  const [saved, setSaved] = useState<SavedAddress | null | false>(null) // null=loading, false=none
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    getSavedAddress().then(addr => setSaved(addr ?? false))
  }, [])

  useEffect(() => {
    if (!user) { setPrefs(null); return }
    getPreferences(user.id).then(setPrefs)
  }, [user])

  async function handleRemindersPress() {
    if (user) { router.push('/notifications'); return }
    if (!saved) return
    setEnabling(true)
    try {
      if (saved.manualSchedules) {
        await enableRemindersForManualSchedule(saved.manualSchedules)
      } else {
        await enableRemindersForAddress(saved.street, saved.city, saved.state, saved.place, saved.events)
      }
      router.push('/notifications')
    } catch {
      Alert.alert('Error', 'Could not turn on reminders. Please try again.')
    } finally {
      setEnabling(false)
    }
  }

  function handleDeleteData() {
    Alert.alert(
      'Delete my data',
      'This will permanently delete your saved address and reminders. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            try {
              await clearSavedAddress()
              if (user) {
                await deleteAccount()
                await signOut()
              }
              router.replace('/')
            } catch {
              Alert.alert('Error', 'Could not delete your data. Please try again.')
            }
          },
        },
      ]
    )
  }

  function remindersSummary(): string {
    if (!prefs) return '—'
    const on: string[] = []
    if (prefs.notifications_garbage) on.push('Garbage')
    if (prefs.notifications_recycling) on.push('Recycling')
    if (prefs.notifications_yard_waste) on.push('Yard Waste')
    return on.length ? on.join(' · ') : 'Off'
  }

  function addressSummary(): string {
    if (!saved) return 'None saved'
    if (saved.manualSchedules) return 'Manually entered'
    return `${toTitleCase(saved.street)}, ${toTitleCase(saved.city)}, ${saved.state.toUpperCase()}`
  }

  if (saved === null) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Account</Text>

        <View style={styles.tilesRow}>
          <Pressable
            style={styles.tile}
            onPress={handleRemindersPress}
            disabled={enabling}
            accessibilityRole="button"
            accessibilityLabel="Reminders settings"
          >
            <Text style={styles.tileIcon}>🔔</Text>
            <Text style={styles.tileLabel}>Reminders</Text>
            <Text style={styles.tileSub}>
              {enabling ? 'Turning on…' : (user ? remindersSummary() : 'Tap to turn on')}
            </Text>
          </Pressable>

          <Pressable
            style={styles.tile}
            onPress={() => router.push('/(tabs)/search')}
            accessibilityRole="button"
            accessibilityLabel="Change saved address"
          >
            <Text style={styles.tileIcon}>📍</Text>
            <Text style={styles.tileLabel}>Address</Text>
            <Text style={styles.tileSub}>{addressSummary()}</Text>
          </Pressable>
        </View>

        <Pressable style={styles.deleteRow} onPress={handleDeleteData} accessibilityRole="button">
          <Text style={styles.deleteText}>Delete my data</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  tilesRow: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  tileIcon: { fontSize: 22 },
  tileLabel: { fontSize: 13, fontWeight: '600', color: colors.text },
  tileSub: { fontSize: 11, color: colors.textSecondary },
  deleteRow: {
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  deleteText: { fontSize: 13, color: colors.error },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- "app/(tabs)/account.test.tsx"`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/account.tsx" "app/(tabs)/account.test.tsx"
git commit -m "feat: Account tab reads local address, gates reminders on account existence

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 13: Final verification

**Files:** None — verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — every test file in the repo, with no `signUp`/`signIn`/`changePassword`/`sign-in`/`check-email`/`change-password` references remaining.

- [ ] **Step 2: Grep for anything missed**

Run: `grep -rn "signUp\|signInWithPassword\|'/sign-in'\|change-password\|check-email" app src`
Expected: no matches.

- [ ] **Step 3: Grep for any remaining userId prop on SaveAddressBanner**

Run: `grep -rn "userId=" src/components/SaveAddressBanner.tsx src/components/ScheduleContent.tsx`
Expected: no matches.

- [ ] **Step 4: Push the branch and open a PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat: remove sign-in wall, local-first saved address" \
  --body "Implements docs/superpowers/specs/2026-10-25-anonymous-local-first.md.

Saving an address and viewing its schedule now work entirely on-device, with
no account. Turning on push reminders is the only action that creates an
anonymous Supabase account. No backend changes — RLS/Edge Functions/cron all
key off auth.uid(), which anonymous auth satisfies identically.

🤖 Generated with [Claude Code](https://claude.com/claude-code)" \
  --base main
```
