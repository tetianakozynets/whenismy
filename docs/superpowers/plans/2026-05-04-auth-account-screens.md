# Plan 3.5 — Auth & Account Screens Implementation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement bottom tab navigation for signed-in users, redesign the sign-in screen, build the Account tab with tiles layout, and add the "Save as my address" banner on the schedule screen.

**Architecture:** Signed-in users are routed to `app/(tabs)/` which renders Schedule, Search, and Account tabs with a custom `BottomTabBar`. Anonymous users keep the existing `app/index.tsx` → `app/schedule.tsx` flow. Auth state from `useAuth()` in `app/index.tsx` triggers a `<Redirect>` to `/(tabs)/schedule`. The Schedule tab fetches the saved address from `user_preferences` then calls `lookupSchedule` to get events. `SaveAddressBanner` in `ScheduleContent` lets signed-in users save the currently displayed address.

**Tech Stack:** Expo Router v3, `@expo/vector-icons` (Ionicons), Supabase JS v2, existing auth/api/user-api infrastructure (all already built).

---

## What already exists — do NOT rebuild

These files are **fully functional** and must not be touched unless a task explicitly says to modify them:

| File | Status |
|---|---|
| `src/lib/auth.ts` | ✅ complete |
| `src/lib/auth-context.tsx` | ✅ complete |
| `src/lib/user-api.ts` | ✅ complete |
| `src/lib/push-notifications.ts` | ✅ complete |
| `src/lib/supabase.ts` | ✅ complete |
| `src/lib/manual-schedule.ts` | ✅ complete |
| `app/notifications.tsx` | ✅ complete — keep as-is |
| `app/address-not-found.tsx` | ✅ complete — keep as-is |
| `app/manual-entry.tsx` | ✅ complete — keep as-is |

---

## File map

| File | Action | Purpose |
|---|---|---|
| `src/lib/types.ts` | Modify | Add NJ providers to PlaceInfo.provider union |
| `src/components/BottomTabBar.tsx` | Create | Custom tab bar — 3 tabs, Ionicons, red active state |
| `src/components/BottomTabBar.test.tsx` | Create | Render tests for tab bar |
| `app/(tabs)/_layout.tsx` | Create | Expo Router Tabs navigator using BottomTabBar |
| `app/(tabs)/schedule.tsx` | Create | Schedule tab — auto-load saved address, empty state |
| `app/(tabs)/search.tsx` | Create | Search tab — address form + inline result |
| `app/(tabs)/account.tsx` | Create | Account tab — tiles (Reminders, Address), sign out |
| `app/_layout.tsx` | Modify | Register (tabs) group in the root Stack |
| `app/index.tsx` | Modify | Redirect signed-in users to /(tabs)/schedule |
| `app/sign-in.tsx` | Modify | Redesign: hero + form panel layout |
| `src/components/SaveAddressBanner.tsx` | Create | "Save as my address" bordered card |
| `src/components/SaveAddressBanner.test.tsx` | Create | Tests for banner visibility and save flow |
| `src/components/ScheduleContent.tsx` | Modify | Add savedAddress + showBack props, SaveAddressBanner, remove gear icon |

---

## Task 1: Fix PlaceInfo provider type

**Files:**
- Modify: `src/lib/types.ts`

The `provider` field currently misses the three NJ providers added in Plan 4. TypeScript will silently accept unknown strings, but keeping the union correct prevents future mistakes.

- [ ] **Step 1: Update the provider union in `src/lib/types.ts`**

Find this line:
```ts
provider: 'nyc-dsny' | 'recollect-ical' | 'recollect' | null
```

Replace with:
```ts
provider: 'nyc-dsny' | 'recollect-ical' | 'recollect' | 'recyclecoach' | 'hoboken-static' | 'jersey-city' | null
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass (no logic change, type only).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "fix: add NJ providers to PlaceInfo.provider union"
```

---

## Task 2: BottomTabBar component

**Files:**
- Create: `src/components/BottomTabBar.tsx`
- Create: `src/components/BottomTabBar.test.tsx`

The custom tab bar uses Ionicons from `@expo/vector-icons` (already installed with Expo SDK 54). Active tab: filled icon + label in `colors.primary` (`#e94560`). Inactive: outline icon + label in `colors.textSecondary` (`#888888`).

- [ ] **Step 1: Write the failing test**

Create `src/components/BottomTabBar.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { BottomTabBar } from './BottomTabBar'

const makeProps = (activeIndex = 0) => ({
  state: {
    index: activeIndex,
    routes: [{ name: 'schedule' }, { name: 'search' }, { name: 'account' }],
  },
  navigation: { navigate: jest.fn() },
})

describe('BottomTabBar', () => {
  it('renders three tabs', () => {
    const { getByText } = render(<BottomTabBar {...makeProps()} />)
    expect(getByText('Schedule')).toBeTruthy()
    expect(getByText('Search')).toBeTruthy()
    expect(getByText('Account')).toBeTruthy()
  })

  it('calls navigation.navigate when a tab is pressed', () => {
    const props = makeProps(0)
    const { getByLabelText } = render(<BottomTabBar {...props} />)
    fireEvent.press(getByLabelText('Search'))
    expect(props.navigation.navigate).toHaveBeenCalledWith('search')
  })

  it('marks the active tab with selected accessibility state', () => {
    const { getByLabelText } = render(<BottomTabBar {...makeProps(1)} />)
    expect(getByLabelText('Search').props.accessibilityState).toEqual({ selected: true })
    expect(getByLabelText('Schedule').props.accessibilityState).toEqual({ selected: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false BottomTabBar
```

Expected: FAIL — `BottomTabBar` not found.

- [ ] **Step 3: Create `src/components/BottomTabBar.tsx`**

```tsx
import React from 'react'
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing } from '../constants/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface TabBarProps {
  state: { index: number; routes: Array<{ name: string }> }
  navigation: { navigate: (name: string) => void }
}

const TABS: { name: string; label: string; icon: IoniconName; activeIcon: IoniconName }[] = [
  { name: 'schedule', label: 'Schedule', icon: 'calendar-outline', activeIcon: 'calendar' },
  { name: 'search',   label: 'Search',   icon: 'search-outline',   activeIcon: 'search'   },
  { name: 'account',  label: 'Account',  icon: 'person-outline',   activeIcon: 'person'   },
]

export function BottomTabBar({ state, navigation }: TabBarProps) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab, index) => {
        const isActive = state.index === index
        return (
          <Pressable
            key={tab.name}
            style={styles.tab}
            onPress={() => navigation.navigate(tab.name)}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Ionicons
              name={isActive ? tab.activeIcon : tab.icon}
              size={24}
              color={isActive ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? 24 : spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --watchAll=false BottomTabBar
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/BottomTabBar.tsx src/components/BottomTabBar.test.tsx
git commit -m "feat: add BottomTabBar component with Ionicons"
```

---

## Task 3: Tabs group — layout + three tab screens

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/schedule.tsx`
- Create: `app/(tabs)/search.tsx`
- Create: `app/(tabs)/account.tsx`

These four files form the signed-in navigation. The `(tabs)` directory name is an Expo Router route group — it doesn't appear in the URL.

- [ ] **Step 1: Create `app/(tabs)/_layout.tsx`**

```tsx
import { Tabs } from 'expo-router'
import { BottomTabBar } from '../../src/components/BottomTabBar'

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={props => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="account" />
    </Tabs>
  )
}
```

- [ ] **Step 2: Create `app/(tabs)/schedule.tsx`**

```tsx
import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../src/lib/auth-context'
import { getPreferences } from '../../src/lib/user-api'
import { lookupSchedule, isError } from '../../src/lib/api'
import { ScheduleContent } from '../../src/components/ScheduleContent'
import { LookupResponse, UserPreferences } from '../../src/lib/types'
import { toTitleCase } from '../../src/lib/formatting'
import { colors, spacing, radius } from '../../src/constants/theme'

export default function ScheduleTab() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<UserPreferences | null | false>(null) // null=loading, false=no prefs
  const [result, setResult] = useState<LookupResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setPrefs(null)
    setLoadError(null)
    const p = await getPreferences(user.id)
    if (!p?.street) { setPrefs(false); return }
    setPrefs(p)
    const res = await lookupSchedule(p.street, p.city, p.state)
    if (isError(res)) { setLoadError(res.error); return }
    setResult(res)
  }, [user])

  useEffect(() => { load() }, [load])

  if (!user) return null

  // Loading
  if (prefs === null) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    )
  }

  // No saved address
  if (prefs === false) {
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

  const address = [toTitleCase(prefs.street), toTitleCase(prefs.city), prefs.state.toUpperCase()].join(', ')

  return (
    <ScheduleContent
      result={result}
      onBack={load}
      address={address}
      showBack={false}
      savedAddress={{ street: prefs.street, city: prefs.city, state: prefs.state }}
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

- [ ] **Step 3: Create `app/(tabs)/search.tsx`**

This is the same search form as `app/index.tsx` but for signed-in users inside the tab layout. It renders inline results (no navigation to `/schedule`). On wide screens it uses `SplitLayout`; on narrow screens it shows the form, then replaces it with the result and a "New search" button.

```tsx
import React, { useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, SafeAreaView,
} from 'react-native'
import { useWindowDimensions } from 'react-native'
import { AddressForm } from '../../src/components/AddressForm'
import { AddressMatchPicker } from '../../src/components/AddressMatchPicker'
import { ScheduleContent } from '../../src/components/ScheduleContent'
import { SplitLayout } from '../../src/components/SplitLayout'
import { SchedulePanel } from '../../src/components/SchedulePanel'
import { lookupSchedule, isError } from '../../src/lib/api'
import { scheduleStore } from '../../src/lib/schedule-store'
import { toTitleCase } from '../../src/lib/formatting'
import { LookupResponse, PlaceMatch } from '../../src/lib/types'
import { colors, spacing } from '../../src/constants/theme'
import { SPLIT_BREAKPOINT } from '../../src/constants/theme'

export default function SearchTab() {
  const { width } = useWindowDimensions()
  const isSplit = width >= SPLIT_BREAKPOINT

  const [result, setResult] = useState<LookupResponse | null>(null)
  const [address, setAddress] = useState<string | undefined>()
  const [notFound, setNotFound] = useState(false)
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  async function handleLookup(street: string, city: string, state: string) {
    setLoading(true)
    setNotFound(false)
    setResult(null)
    const res = await lookupSchedule(street, city, state)
    setLoading(false)
    if (isError(res)) {
      if (res.notFound) setNotFound(true)
      return
    }
    if (res.multiple && res.multiple.length >= 1) {
      scheduleStore.set(res, street, city, state)
      setMatches(res.multiple)
      return
    }
    scheduleStore.set(res, street, city, state)
    setResult(res)
    setAddress([toTitleCase(street), toTitleCase(city), state.toUpperCase()].join(', '))
  }

  function handleMatchSelect(_match: PlaceMatch) {
    setMatches(null)
    const stored = scheduleStore.get()
    if (stored) {
      setResult(stored.result)
      setAddress([toTitleCase(stored.street), toTitleCase(stored.city), stored.state.toUpperCase()].join(', '))
    }
  }

  function handleReset() {
    setResult(null)
    setAddress(undefined)
    setNotFound(false)
    setMatches(null)
    setResetKey(k => k + 1)
  }

  const formContent = (
    <>
      <Text style={styles.title}>WIM</Text>
      <Text style={styles.subtitle}>Search any address</Text>
      <AddressForm key={resetKey} onSubmit={handleLookup} loading={loading} />
      {notFound && (
        <Text style={styles.notFoundText}>
          We couldn't find that address. Please double-check and try again.
        </Text>
      )}
    </>
  )

  if (isSplit) {
    return (
      <>
        <SplitLayout
          form={<View style={styles.formPadding}>{formContent}</View>}
          panel={
            <SchedulePanel
              result={result}
              onReset={handleReset}
              address={address}
              notFound={notFound}
              savedAddress={undefined}
            />
          }
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

  if (result) {
    return (
      <ScheduleContent
        result={result}
        onBack={handleReset}
        address={address}
        showBack={true}
        savedAddress={undefined}
      />
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
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  formPadding: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  notFoundText: {
    color: colors.error, fontSize: 14, textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
})
```

- [ ] **Step 4: Create `app/(tabs)/account.tsx`**

```tsx
import React, { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, SafeAreaView,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../../src/lib/auth-context'
import { signOut } from '../../src/lib/auth'
import { getPreferences, deleteAccount } from '../../src/lib/user-api'
import { UserPreferences } from '../../src/lib/types'
import { colors, spacing, radius } from '../../src/constants/theme'

export default function AccountTab() {
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

  function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This will permanently delete your account and all saved data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteAccount()
            await signOut()
            router.replace('/')
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
    if (!prefs?.city) return 'None saved'
    return `${prefs.city}, ${prefs.state}`
  }

  if (!user) return null

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Account</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : (
          <>
            {/* Action tiles */}
            <View style={styles.tilesRow}>
              <Pressable
                style={styles.tile}
                onPress={() => router.push('/notifications')}
                accessibilityRole="button"
                accessibilityLabel="Reminders settings"
              >
                <Text style={styles.tileIcon}>🔔</Text>
                <Text style={styles.tileLabel}>Reminders</Text>
                <Text style={styles.tileSub}>{remindersSummary()}</Text>
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

            {/* Signed in as */}
            <View style={styles.emailCard}>
              <Text style={styles.emailLabel}>Signed in as</Text>
              <Text style={styles.emailText}>{user.email}</Text>
            </View>
          </>
        )}

        <Pressable
          style={styles.row}
          onPress={handleSignOut}
          accessibilityRole="button"
        >
          <Text style={styles.rowText}>Sign out</Text>
        </Pressable>

        <Pressable
          style={styles.row}
          onPress={handleDeleteAccount}
          accessibilityRole="button"
        >
          <Text style={[styles.rowText, styles.danger]}>Delete account</Text>
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
  emailCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  emailLabel: { fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  emailText: { fontSize: 14, color: colors.text },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowText: { fontSize: 16, color: colors.text },
  danger: { color: colors.error },
})
```

- [ ] **Step 5: Run tests**

```bash
npm test -- --watchAll=false
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add app/\(tabs\)/
git commit -m "feat: add (tabs) group — Schedule, Search, Account tabs"
```

---

## Task 4: Auth-based routing

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/index.tsx`

Signed-in users who open the app are redirected from `/` to `/(tabs)/schedule`. The root Stack needs the `(tabs)` screen registered.

- [ ] **Step 1: Update `app/_layout.tsx`**

Replace the entire file content:

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
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="manual-entry" />
      </Stack>
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Add auth redirect to `app/index.tsx`**

Find the start of the component function body in `app/index.tsx` (after the `useState` declarations). Add the redirect right after the `useAuth` call:

```tsx
// existing line:
const { user } = useAuth()

// add immediately after:
if (user) return <Redirect href="/(tabs)/schedule" />
```

Also add the import at the top of the file with the other expo-router imports:

```tsx
import { router, Redirect } from 'expo-router'
```

- [ ] **Step 3: Run tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx app/index.tsx
git commit -m "feat: redirect signed-in users to (tabs)/schedule"
```

---

## Task 5: Redesign sign-in screen

**Files:**
- Modify: `app/sign-in.tsx`

Replace the current layout (centered form) with the hero + form panel design from the spec: WIM title + pickup type pills in the top half, email/password form in the bottom card.

- [ ] **Step 1: Replace `app/sign-in.tsx`**

```tsx
import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { signUp, signIn } from '../src/lib/auth'
import { colors, spacing, radius } from '../src/constants/theme'
import { scheduleStore } from '../src/lib/schedule-store'
import { saveAddress, savePickupEvents } from '../src/lib/user-api'
import { registerPushToken } from '../src/lib/push-notifications'

const PILLS = [
  { icon: '🗑️', label: 'Garbage' },
  { icon: '♻️', label: 'Recycling' },
  { icon: '🍂', label: 'Yard Waste' },
]

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
        const { data, error: err } = await signIn(e, p)
        if (err) { setError(err.message); return }
        const userId = data.user?.id
        if (userId) {
          const stored = scheduleStore.get()
          if (stored) {
            await saveAddress(userId, stored.street, stored.city, stored.state, stored.result.place)
            await savePickupEvents(userId, stored.result.events)
          }
          registerPushToken(userId)
        }
        router.replace('/(tabs)/schedule')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Hero */}
        <LinearGradient
          colors={['#0d0d1a', '#1a1a2e']}
          style={styles.hero}
        >
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
          <Text style={styles.heroTitle}>WIM</Text>
          <Text style={styles.heroSub}>When Is My</Text>
          <Text style={styles.heroTagline}>Never miss garbage day again.</Text>
          <View style={styles.pills}>
            {PILLS.map(p => (
              <View key={p.label} style={styles.pill}>
                <Text style={styles.pillText}>{p.icon} {p.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Form panel */}
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>
            {mode === 'signup' ? 'Create your account' : 'Sign in'}
          </Text>
          <Text style={styles.panelSub}>
            {mode === 'signup'
              ? 'Save your address and get reminders the night before.'
              : 'Welcome back. Sign in to your account.'}
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },

  // Hero
  hero: {
    padding: spacing.lg,
    paddingTop: 60,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
    minHeight: 280,
    justifyContent: 'center',
  },
  backRow: { position: 'absolute', top: spacing.lg, left: spacing.lg },
  backLink: { color: colors.primary, fontSize: 15 },
  heroTitle: { fontSize: 48, fontWeight: '900', color: colors.primary, letterSpacing: 2 },
  heroSub: { fontSize: 12, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 3 },
  heroTagline: { fontSize: 16, color: colors.text, fontWeight: '500', marginTop: spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  pill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  pillText: { fontSize: 13, color: colors.textSecondary },

  // Form panel
  panel: {
    flex: 1,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  panelTitle: { fontSize: 22, fontWeight: '700', color: colors.text },
  panelSub: { fontSize: 14, color: colors.textSecondary },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.background,
    color: colors.text,
  },
  error: { color: colors.error, fontSize: 14 },
  info: { color: '#10B981', fontSize: 14 },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggleRow: { alignItems: 'center', paddingVertical: spacing.sm },
  toggleText: { color: colors.primary, fontSize: 14 },
})
```

- [ ] **Step 2: Run tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/sign-in.tsx
git commit -m "feat: redesign sign-in screen with hero + form panel layout"
```

---

## Task 6: SaveAddressBanner + ScheduleContent update

**Files:**
- Create: `src/components/SaveAddressBanner.tsx`
- Create: `src/components/SaveAddressBanner.test.tsx`
- Modify: `src/components/ScheduleContent.tsx`

`SaveAddressBanner` shows on the schedule screen when a signed-in user is viewing an address that isn't their saved one. After saving it becomes a confirmation link to Notifications.

- [ ] **Step 1: Write the failing tests**

Create `src/components/SaveAddressBanner.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { SaveAddressBanner } from './SaveAddressBanner'

jest.mock('../lib/user-api', () => ({
  saveAddress: jest.fn().mockResolvedValue({}),
  savePickupEvents: jest.fn().mockResolvedValue({}),
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

describe('SaveAddressBanner', () => {
  it('renders when address is not saved', () => {
    const { getByText } = render(
      <SaveAddressBanner
        userId="u1"
        street="1 Main St"
        city="Mahwah"
        state="NJ"
        place={mockPlace}
        events={mockEvents}
        isSaved={false}
      />
    )
    expect(getByText(/Save as my address/i)).toBeTruthy()
  })

  it('renders nothing when address is already saved', () => {
    const { queryByText } = render(
      <SaveAddressBanner
        userId="u1"
        street="1 Main St"
        city="Mahwah"
        state="NJ"
        place={mockPlace}
        events={mockEvents}
        isSaved={true}
      />
    )
    expect(queryByText(/Save as my address/i)).toBeNull()
  })

  it('shows confirmation after saving', async () => {
    const { getByText } = render(
      <SaveAddressBanner
        userId="u1"
        street="1 Main St"
        city="Mahwah"
        state="NJ"
        place={mockPlace}
        events={mockEvents}
        isSaved={false}
      />
    )
    fireEvent.press(getByText('Save'))
    await waitFor(() => {
      expect(getByText(/Address saved/i)).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --watchAll=false SaveAddressBanner
```

Expected: FAIL — `SaveAddressBanner` not found.

- [ ] **Step 3: Create `src/components/SaveAddressBanner.tsx`**

```tsx
import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { PlaceInfo, PickupEvent } from '../lib/types'
import { saveAddress, savePickupEvents } from '../lib/user-api'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  userId: string
  street: string
  city: string
  state: string
  place: PlaceInfo
  events: PickupEvent[]
  isSaved: boolean
}

export function SaveAddressBanner({ userId, street, city, state, place, events, isSaved }: Props) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  if (isSaved || saved) {
    if (!saved) return null
    return (
      <Pressable style={[styles.banner, styles.bannerSaved]} onPress={() => router.push('/notifications')} accessibilityRole="button">
        <Text style={styles.savedText}>✓ Address saved — set up reminders →</Text>
      </Pressable>
    )
  }

  async function handleSave() {
    setSaving(true)
    await saveAddress(userId, street, city, state, place)
    await savePickupEvents(userId, events)
    setSaving(false)
    setSaved(true)
  }

  return (
    <View style={styles.banner}>
      <View style={styles.bannerLeft}>
        <Text style={styles.bannerIcon}>📍</Text>
        <Text style={styles.bannerText}>Save as my address</Text>
      </View>
      <Pressable style={styles.saveButton} onPress={handleSave} disabled={saving} accessibilityRole="button">
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.saveButtonText}>Save</Text>
        }
      </Pressable>
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
})
```

- [ ] **Step 4: Run tests**

```bash
npm test -- --watchAll=false SaveAddressBanner
```

Expected: 3 tests pass.

- [ ] **Step 5: Update `src/components/ScheduleContent.tsx`**

The component needs three changes:
1. Accept `savedAddress` and `showBack` props
2. Show `SaveAddressBanner` for signed-in users when `savedAddress` is undefined (viewing an unsaved address)
3. Remove the gear icon (Account tab replaces it)

Find the `Props` interface at the top of `ScheduleContent.tsx` and replace it:

```tsx
interface Props {
  result: LookupResponse
  onBack: () => void
  address?: string
  showBack?: boolean           // default true — hide in Schedule tab (tab bar handles navigation)
  savedAddress?: { street: string; city: string; state: string } | undefined
}
```

Add the import for `SaveAddressBanner` at the top of the file (with other imports):

```tsx
import { SaveAddressBanner } from './SaveAddressBanner'
```

Update the function signature to destructure the new props:

```tsx
export function ScheduleContent({ result, onBack, address, showBack = true, savedAddress }: Props) {
```

Remove the gear icon block entirely (find and delete):

```tsx
// DELETE this entire block:
{user && (
  <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" style={isWide && styles.gearRight}>
    <Text style={styles.gear}>⚙️</Text>
  </Pressable>
)}
```

Change the back link condition from `!isWide` to `showBack && !isWide`:

```tsx
{showBack && !isWide && (
  <Pressable onPress={onBack} accessibilityRole="button">
    <Text style={styles.backLink}>← Change address</Text>
  </Pressable>
)}
```

Add these two lines in the component body, right after the `const grouped = groupByDate(events)` line:

```tsx
// Parse the address_key ("street|city|state" lowercase) to get raw fields for saving
const [addrStreet, addrCity, addrState] = (place.address_key || '||').split('|')
// Banner is hidden when savedAddress matches the currently displayed address
const isCurrentAddressSaved = savedAddress !== undefined && (
  savedAddress.street.toLowerCase().trim() === addrStreet.trim() &&
  savedAddress.city.toLowerCase().trim() === addrCity.trim() &&
  savedAddress.state.toLowerCase().trim() === addrState.trim()
)
```

Then add the `SaveAddressBanner` right after the `<NextPickupCard>` line:

```tsx
<NextPickupCard events={firstDayEvents} todayNote={todayHolidayNote(holidays)} skippedHoliday={skippedHoliday} />
{user && !isCurrentAddressSaved && (
  <SaveAddressBanner
    userId={user.id}
    street={addrStreet}
    city={addrCity}
    state={addrState}
    place={place}
    events={events}
    isSaved={false}
  />
)}
```

Also remove the `gear` and `gearRight` style entries from the StyleSheet at the bottom since they're no longer used.

- [ ] **Step 6: Run all tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/SaveAddressBanner.tsx src/components/SaveAddressBanner.test.tsx src/components/ScheduleContent.tsx
git commit -m "feat: add SaveAddressBanner and wire into ScheduleContent"
```

---

## Task 7: Final wiring + smoke test

**Files:** no new files — verify the full flow works end-to-end.

- [ ] **Step 1: Run the full test suite**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass (new ones + all existing 73).

- [ ] **Step 2: Start the dev server and verify anonymous flow**

```bash
npx expo start --web
```

Open `http://localhost:8081`. As an anonymous user:
- See the search form (WIM title, address inputs, state chips)
- Search a valid NJ or NYC address → see schedule
- Click "Get reminders the night before pickup — Sign in →" → goes to the hero sign-in screen
- The hero shows WIM title, pickup type pills, gradient background
- Bottom form panel has email, password, Create account button

- [ ] **Step 3: Verify signed-in flow (use local Supabase)**

Sign up with a test email (skip email confirmation for local dev — Supabase local skips it by default):
- After sign-in → redirected to Schedule tab
- Schedule tab shows empty state with "Go to Search →" button
- Bottom tab bar shows 📅 Schedule · 🔍 Search · 👤 Account with filled/outline Ionicons
- Tap Search → address form
- Search Mahwah, NJ address → see schedule → "Save as my address" banner appears
- Tap Save → banner changes to "✓ Address saved — set up reminders →"
- Tap Schedule tab → saved schedule auto-loads
- Tap Account tab → tiles show Reminders and Address (city, state), email card, Sign out
- Tap Reminders tile → notifications screen
- Tap Address tile → goes to Search tab
- Sign out → back to anonymous home

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: Plan 3.5 complete — auth navigation, account tiles, sign-in redesign"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| Hero + form panel sign-in layout | Task 5 |
| Email only auth | Task 5 (no social buttons) |
| Account tiles — Reminders + Address | Task 3 (account.tsx) |
| Reminders tile → Notifications screen | Task 3 |
| Address tile → Search tab | Task 3 |
| Email card (display only) | Task 3 |
| Sign out | Task 3 |
| Delete account | Task 3 |
| Bottom tabs, 3 tabs, filled-red active | Task 2 + Task 3 |
| Signed-in home → auto-load saved address | Task 3 (schedule.tsx) |
| Empty state → "Go to Search" | Task 3 (schedule.tsx) |
| Save as my address banner | Task 6 |
| Banner confirmation → reminders link | Task 6 |
| showBack=false on Schedule tab | Task 3 + Task 6 |
| Auth redirect in index.tsx | Task 4 |
| PlaceInfo NJ providers | Task 1 |
