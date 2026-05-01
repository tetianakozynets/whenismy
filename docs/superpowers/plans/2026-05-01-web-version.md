# Web Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Expo web output into a proper desktop experience: fix the color system to the original dark theme, add emoji icons to pickup type badges, and add a responsive split-panel layout for screens ≥ 768px wide.

**Architecture:** The split panel is rendered by `index.tsx` using a `useSplitLayout()` hook. On wide screens, lookup results are held in local React state and passed as props to `SchedulePanel`. On narrow screens, the existing navigation to `/schedule` is unchanged. `schedule.tsx` redirects to `/` on wide screens. A shared `ScheduleContent` component is used by both `SchedulePanel` and `schedule.tsx` to avoid duplicated JSX.

**Tech Stack:** Expo (React Native + web), `expo-linear-gradient` (new dep), `useWindowDimensions` from React Native, `@testing-library/react-native` for tests.

**QA review applied:** mounted guard added to `useSplitLayout` to prevent SSR layout flash; `useEffect` dep array fixed in `schedule.tsx`; `jest.spyOn` used instead of `jest.mock('react-native')` for jest-expo compatibility; `ScheduleContent` extracted to eliminate duplication; form reset clears inputs via `key` prop; `useSplitLayout` mock added to `index.test.tsx`.

---

### Task 1: Update color tokens and fix AddressForm text colors

**Files:**
- Modify: `src/constants/theme.ts`
- Modify: `src/components/AddressForm.tsx`

- [ ] **Step 1: Update theme.ts**

Replace the full contents of `src/constants/theme.ts`:

```ts
export const colors = {
  garbage: '#6B7280',
  recycling: '#10B981',
  yard_waste: '#84CC16',
  background: '#0d0d1a',
  card: '#1a1a2e',
  primary: '#e94560',
  text: '#FFFFFF',
  textSecondary: '#888888',
  border: '#2a2a4a',
  error: '#EF4444',
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
}

export const SPLIT_BREAKPOINT = 768
```

- [ ] **Step 2: Fix AddressForm for dark background**

In `src/components/AddressForm.tsx`, add `placeholderTextColor` props to each TextInput and `color: colors.text` to `styles.input` so text is readable on the dark card.

Replace the three `TextInput` elements:

```tsx
      <TextInput
        style={styles.input}
        placeholder="Street address"
        placeholderTextColor={colors.textSecondary}
        value={street}
        onChangeText={setStreet}
        testID="input-street"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <TextInput
        style={styles.input}
        placeholder="City"
        placeholderTextColor={colors.textSecondary}
        value={city}
        onChangeText={setCity}
        testID="input-city"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <TextInput
        style={styles.input}
        placeholder="State (e.g. NY)"
        placeholderTextColor={colors.textSecondary}
        value={state}
        onChangeText={setState}
        testID="input-state"
        maxLength={2}
        autoCapitalize="characters"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
```

Replace `styles.input`:

```ts
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
```

- [ ] **Step 3: Run the app and verify dark theme**

```bash
npx expo start --web
```

Open http://localhost:8081. Confirm: deep navy background, dark card inputs with visible text, pink button.

- [ ] **Step 4: Commit**

```bash
git add src/constants/theme.ts src/components/AddressForm.tsx
git commit -m "feat: apply dark theme — navy background, pink primary, update AddressForm"
```

---

### Task 2: Add emoji icon lookup

**Files:**
- Create: `src/lib/event-icons.ts`
- Create: `src/lib/event-icons.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/event-icons.test.ts`:

```ts
import { eventTypeIcon } from './event-icons'

it('returns trash emoji for garbage', () => {
  expect(eventTypeIcon('garbage')).toBe('🗑️')
})

it('returns recycle emoji for recycling', () => {
  expect(eventTypeIcon('recycling')).toBe('♻️')
})

it('returns leaf emoji for yard_waste', () => {
  expect(eventTypeIcon('yard_waste')).toBe('🌿')
})

it('returns box emoji for bulk_waste', () => {
  expect(eventTypeIcon('bulk_waste')).toBe('📦')
})

it('returns truck emoji for unknown types', () => {
  expect(eventTypeIcon('hazardous')).toBe('🚛')
})

it('returns truck emoji for organics (not in map)', () => {
  expect(eventTypeIcon('organics')).toBe('🚛')
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=event-icons --watchAll=false
```

Expected: FAIL — `Cannot find module './event-icons'`

- [ ] **Step 3: Implement event-icons.ts**

Create `src/lib/event-icons.ts`:

```ts
const EVENT_ICONS: Record<string, string> = {
  garbage: '🗑️',
  recycling: '♻️',
  yard_waste: '🌿',
  bulk_waste: '📦',
}

export function eventTypeIcon(eventType: string): string {
  return EVENT_ICONS[eventType] ?? '🚛'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=event-icons --watchAll=false
```

Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/event-icons.ts src/lib/event-icons.test.ts
git commit -m "feat: add emoji icon lookup for pickup types"
```

---

### Task 3: Update EventTypeBadge to show emoji

**Files:**
- Modify: `src/components/EventTypeBadge.tsx`
- Modify: `src/components/EventTypeBadge.test.tsx`

- [ ] **Step 1: Run existing badge tests to confirm they pass before changes**

```bash
npm test -- --testPathPattern=EventTypeBadge --watchAll=false
```

Expected: PASS — 4 tests

- [ ] **Step 2: Update EventTypeBadge.tsx**

Replace the full contents of `src/components/EventTypeBadge.tsx`:

```tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, radius } from '../constants/theme'
import { eventTypeLabel } from '../lib/formatting'
import { eventTypeIcon } from '../lib/event-icons'

interface Props {
  eventType: string
}

export function EventTypeBadge({ eventType }: Props) {
  const bgColor = (colors as Record<string, string>)[eventType] ?? colors.textSecondary
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={styles.emoji}>{eventTypeIcon(eventType)}</Text>
      <Text style={styles.label}>{eventTypeLabel(eventType)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  emoji: {
    fontSize: 12,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
})
```

- [ ] **Step 3: Add emoji presence test to EventTypeBadge.test.tsx**

Add this test to `src/components/EventTypeBadge.test.tsx`:

```tsx
it('renders emoji icon alongside the label', () => {
  const { getByText } = render(<EventTypeBadge eventType="garbage" />)
  expect(getByText('🗑️')).toBeTruthy()
})
```

- [ ] **Step 4: Run all badge tests**

```bash
npm test -- --testPathPattern=EventTypeBadge --watchAll=false
```

Expected: PASS — 5 tests (4 original + 1 new emoji test)

- [ ] **Step 5: Commit**

```bash
git add src/components/EventTypeBadge.tsx src/components/EventTypeBadge.test.tsx
git commit -m "feat: add emoji icons to EventTypeBadge"
```

---

### Task 4: Update NextPickupCard with gradient and large emoji

**Files:**
- Modify: `src/components/NextPickupCard.tsx`

- [ ] **Step 1: Install expo-linear-gradient**

```bash
npx expo install expo-linear-gradient
```

Expected output ends with: `added N packages`

- [ ] **Step 2: Update NextPickupCard.tsx**

Replace the full contents of `src/components/NextPickupCard.tsx`:

```tsx
import React from 'react'
import { Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { PickupEvent } from '../lib/types'
import { EventTypeBadge } from './EventTypeBadge'
import { eventTypeIcon } from '../lib/event-icons'
import { formatPickupDate, daysUntil, daysUntilLabel } from '../lib/formatting'
import { spacing, radius } from '../constants/theme'

interface Props {
  event: PickupEvent
}

export function NextPickupCard({ event }: Props) {
  const days = daysUntil(event.date)
  return (
    <LinearGradient
      colors={['#e94560', '#c0392b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.bigEmoji}>{eventTypeIcon(event.event_type)}</Text>
      <Text style={styles.eyebrow}>Next pickup</Text>
      <EventTypeBadge eventType={event.event_type} />
      <Text style={styles.date}>{formatPickupDate(event.date)}</Text>
      <Text style={styles.countdown}>{daysUntilLabel(days)}</Text>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bigEmoji: {
    fontSize: 28,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  date: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  countdown: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
})
```

- [ ] **Step 3: Verify the card in the browser**

```bash
npx expo start --web
```

Enter an address, look up a schedule. The "Next pickup" card should show a pink-to-red diagonal gradient with a large emoji above the badge.

- [ ] **Step 4: Commit**

```bash
git add src/components/NextPickupCard.tsx package.json package-lock.json
git commit -m "feat: NextPickupCard — pink gradient background, large emoji icon"
```

---

### Task 5: Add useSplitLayout hook

**Files:**
- Create: `src/lib/use-split-layout.ts`
- Create: `src/lib/use-split-layout.test.ts`

- [ ] **Step 1: Write failing tests**

The hook uses `jest.spyOn` (not `jest.mock`) to avoid fragility with `jest-expo`'s platform resolver. The `mounted` guard means the initial render always returns `false`; after `useEffect` fires (which `renderHook` triggers synchronously in tests via `act`), it returns the real value.

Create `src/lib/use-split-layout.test.ts`:

```ts
import * as RN from 'react-native'
import { renderHook } from '@testing-library/react-native'
import { useSplitLayout } from './use-split-layout'

const spy = jest.spyOn(RN, 'useWindowDimensions')

afterEach(() => {
  jest.clearAllMocks()
})

it('returns true when width is exactly 768', () => {
  spy.mockReturnValue({ width: 768, height: 900, scale: 1, fontScale: 1 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(true)
})

it('returns true when width is greater than 768', () => {
  spy.mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(true)
})

it('returns false when width is 767', () => {
  spy.mockReturnValue({ width: 767, height: 900, scale: 1, fontScale: 1 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(false)
})

it('returns false when width is 375 (iPhone)', () => {
  spy.mockReturnValue({ width: 375, height: 812, scale: 1, fontScale: 1 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(false)
})

it('updates when width crosses the breakpoint', () => {
  spy.mockReturnValue({ width: 400, height: 900, scale: 1, fontScale: 1 })
  const { result, rerender } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(false)
  spy.mockReturnValue({ width: 900, height: 900, scale: 1, fontScale: 1 })
  rerender()
  expect(result.current).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=use-split-layout --watchAll=false
```

Expected: FAIL — `Cannot find module './use-split-layout'`

- [ ] **Step 3: Implement use-split-layout.ts**

The `mounted` guard ensures the hook returns `false` on the server (SSR/static pre-render, where `useWindowDimensions` returns `width: 0`) and only switches to the real value after the client mounts. This prevents a layout flash on desktop web and avoids a React hydration mismatch.

Create `src/lib/use-split-layout.ts`:

```ts
import { useState, useEffect } from 'react'
import { useWindowDimensions } from 'react-native'
import { SPLIT_BREAKPOINT } from '../constants/theme'

export function useSplitLayout(): boolean {
  const { width } = useWindowDimensions()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted && width >= SPLIT_BREAKPOINT
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=use-split-layout --watchAll=false
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-split-layout.ts src/lib/use-split-layout.test.ts
git commit -m "feat: add useSplitLayout hook with SSR-safe mounted guard"
```

---

### Task 6: Create ScheduleContent shared component

Both `SchedulePanel` (wide) and `schedule.tsx` (narrow) render the same schedule UI. This task extracts it once so future changes (Plan 3 auth, notifications) only need to be made in one place.

**Files:**
- Create: `src/components/ScheduleContent.tsx`

- [ ] **Step 1: Create ScheduleContent.tsx**

Create `src/components/ScheduleContent.tsx`:

```tsx
import React from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { LookupResponse } from '../lib/types'
import { NextPickupCard } from './NextPickupCard'
import { ScheduleList } from './ScheduleList'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  result: LookupResponse
  onBack: () => void
}

export function ScheduleContent({ result, onBack }: Props) {
  const { events, place } = result

  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No upcoming pickups found.</Text>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.backLink}>← Change address</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
        <Text style={styles.backLink}>← Change address</Text>
      </Pressable>
      {place.provider === 'nyc-dsny' && (
        <View style={styles.providerBadge}>
          <Text style={styles.providerText}>🗽 NYC official schedule</Text>
        </View>
      )}
      {place.provider === 'recollect-ical' && (
        <View style={styles.providerBadge}>
          <Text style={styles.providerText}>📅 Calendar subscription</Text>
        </View>
      )}
      <NextPickupCard event={events[0]} />
      {events.length > 1 && (
        <>
          <Text style={styles.sectionHeader}>Upcoming</Text>
          <ScheduleList events={events} skipFirst />
        </>
      )}
      <Text style={styles.disclaimer}>
        Schedules may shift on public holidays — check your municipality's website.
      </Text>
      <Pressable style={styles.upsellBanner} accessibilityRole="button">
        <Text style={styles.upsellText}>
          Get reminders the night before pickup — Sign in →
        </Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  empty: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  emptyText: { fontSize: 16, color: colors.textSecondary },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  backRow: { paddingVertical: spacing.xs },
  backLink: { color: colors.primary, fontSize: 15 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  upsellBanner: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  upsellText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  providerBadge: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  providerText: { fontSize: 12, color: colors.textSecondary },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ScheduleContent.tsx
git commit -m "feat: add ScheduleContent — shared schedule UI for panel and screen"
```

---

### Task 7: Create SplitLayout component

**Files:**
- Create: `src/components/SplitLayout.tsx`

- [ ] **Step 1: Create SplitLayout.tsx**

`SplitLayout` always renders the two-column layout. It is only ever mounted when `useSplitLayout()` is `true` — the narrow-screen guard lives in `index.tsx`, not here.

Create `src/components/SplitLayout.tsx`:

```tsx
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { colors } from '../constants/theme'

interface Props {
  form: React.ReactNode
  panel: React.ReactNode
}

export function SplitLayout({ form, panel }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.formColumn}>{form}</View>
      <View style={styles.divider} />
      <View style={styles.panelColumn}>{panel}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  formColumn: {
    width: 320,
    backgroundColor: colors.background,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  panelColumn: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SplitLayout.tsx
git commit -m "feat: add SplitLayout component — 320px form column + flex panel"
```

---

### Task 8: Create SchedulePanel component

**Files:**
- Create: `src/components/SchedulePanel.tsx`

- [ ] **Step 1: Create SchedulePanel.tsx**

`SchedulePanel` handles only the null-result placeholder. All other rendering is delegated to `ScheduleContent`.

Create `src/components/SchedulePanel.tsx`:

```tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LookupResponse } from '../lib/types'
import { ScheduleContent } from './ScheduleContent'
import { colors, spacing } from '../constants/theme'

interface Props {
  result: LookupResponse | null
  onReset: () => void
}

export function SchedulePanel({ result, onReset }: Props) {
  if (!result) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Enter your address on the left to see your schedule
        </Text>
      </View>
    )
  }

  return <ScheduleContent result={result} onBack={onReset} />
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/components/SchedulePanel.tsx
git commit -m "feat: add SchedulePanel — placeholder or ScheduleContent for split panel"
```

---

### Task 9: Refactor index.tsx to use split panel on wide screens

**Files:**
- Modify: `app/index.tsx`
- Modify: `app/index.test.tsx`

- [ ] **Step 1: Add useSplitLayout mock and wide-screen test to index.test.tsx**

The existing `index.test.tsx` will break after the refactor because `HomeScreen` now calls `useSplitLayout()`, which in turn calls `useWindowDimensions()`. Pin the tests to the narrow path and add one wide-screen test.

Replace the full contents of `app/index.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import HomeScreen from './index'
import * as api from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
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
})

it('navigates to /schedule and saves result to store on success (narrow)', async () => {
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
  const { getByTestId } = render(<HomeScreen />)
  fireEvent.changeText(getByTestId('input-street'), '123 Main St')
  fireEvent.changeText(getByTestId('input-city'), 'Springfield')
  fireEvent.changeText(getByTestId('input-state'), 'NY')
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/schedule')
  })
  expect(scheduleStore.get()).toEqual(mockResult)
})

it('navigates to /address-not-found when address is not found', async () => {
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce({
    error: 'Address not found',
    notFound: true,
  })
  const { getByTestId } = render(<HomeScreen />)
  fireEvent.changeText(getByTestId('input-street'), '99 Unknown')
  fireEvent.changeText(getByTestId('input-city'), 'Nowhere')
  fireEvent.changeText(getByTestId('input-state'), 'XX')
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/address-not-found')
  })
})

it('does not navigate on success when in split layout (wide screen)', async () => {
  const { useSplitLayout } = require('../src/lib/use-split-layout')
  useSplitLayout.mockReturnValue(true)
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
  const { getByTestId } = render(<HomeScreen />)
  fireEvent.changeText(getByTestId('input-street'), '123 Main St')
  fireEvent.changeText(getByTestId('input-city'), 'Springfield')
  fireEvent.changeText(getByTestId('input-state'), 'NY')
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    expect(api.lookupSchedule).toHaveBeenCalled()
  })
  const { router } = require('expo-router')
  expect(router.push).not.toHaveBeenCalledWith('/schedule')
})
```

- [ ] **Step 2: Run index tests to confirm they pass before the refactor**

```bash
npm test -- --testPathPattern=index.test --watchAll=false
```

Expected: PASS — 3 tests (the wide-screen test will fail since `HomeScreen` doesn't use `useSplitLayout` yet — that is expected at this step)

- [ ] **Step 3: Replace app/index.tsx**

`resetKey` is incremented by `handleReset`, which forces `AddressForm` to remount and clear its internal input state — satisfying the spec requirement that "← Change address" clears the form on wide screens.

Replace the full contents of `app/index.tsx`:

```tsx
import React, { useState } from 'react'
import {
  View, Text, SafeAreaView, StyleSheet, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { AddressForm } from '../src/components/AddressForm'
import { AddressMatchPicker } from '../src/components/AddressMatchPicker'
import { SplitLayout } from '../src/components/SplitLayout'
import { SchedulePanel } from '../src/components/SchedulePanel'
import { lookupSchedule, isError } from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'
import { useSplitLayout } from '../src/lib/use-split-layout'
import { PlaceMatch, LookupResponse } from '../src/lib/types'
import { colors, spacing } from '../src/constants/theme'

export default function HomeScreen() {
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null)
  const [result, setResult] = useState<LookupResponse | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const isSplit = useSplitLayout()

  async function handleLookup(street: string, city: string, state: string) {
    setLoading(true)
    try {
      const res = await lookupSchedule(street, city, state)
      if (isError(res)) {
        if (res.notFound) {
          router.push('/address-not-found')
        } else {
          Alert.alert('Error', res.error)
        }
        return
      }
      if (res.multiple && res.multiple.length >= 1) {
        scheduleStore.set(res)
        setMatches(res.multiple)
        return
      }
      if (isSplit) {
        setResult(res)
      } else {
        scheduleStore.set(res)
        router.push('/schedule')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleMatchSelect(_match: PlaceMatch) {
    setMatches(null)
    if (isSplit) {
      const stored = scheduleStore.get()
      if (stored) setResult(stored)
    } else {
      router.push('/schedule')
    }
  }

  function handleReset() {
    setResult(null)
    setResetKey(k => k + 1)
  }

  const formContent = (
    <>
      <Text style={styles.title}>whenIsMy</Text>
      <Text style={styles.subtitle}>
        Find your garbage and recycling pickup days
      </Text>
      <AddressForm key={resetKey} onSubmit={handleLookup} loading={loading} />
    </>
  )

  if (isSplit) {
    return (
      <>
        <SplitLayout
          form={<View style={styles.formPadding}>{formContent}</View>}
          panel={<SchedulePanel result={result} onReset={handleReset} />}
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
})
```

- [ ] **Step 4: Run index tests**

```bash
npm test -- --testPathPattern=index.test --watchAll=false
```

Expected: PASS — 3 tests

- [ ] **Step 5: Test wide screen in browser**

```bash
npx expo start --web
```

Open http://localhost:8081 in a browser window wider than 768px. Verify:
- Left column (320px): title, subtitle, form with dark inputs and pink button
- Right column: placeholder "Enter your address on the left to see your schedule"
- Submit an address → right panel shows schedule, no page navigation
- Click "← Change address" → right panel returns to placeholder, form inputs are cleared
- Resize below 768px → collapses to single-column mobile layout

- [ ] **Step 6: Commit**

```bash
git add app/index.tsx app/index.test.tsx
git commit -m "feat: split panel on wide screens — results in right panel, mobile nav unchanged"
```

---

### Task 10: Update schedule.tsx to redirect on wide screens and use ScheduleContent

**Files:**
- Modify: `app/schedule.tsx`

- [ ] **Step 1: Replace app/schedule.tsx**

The `useEffect` dependency array includes `[isSplit, result]` so the redirect fires if `isSplit` changes from `false` to `true` after mount (which happens when `useWindowDimensions` returns the real width after the mounted guard resolves). `router.replace('/')` is idempotent so calling it twice causes no loop.

Replace the full contents of `app/schedule.tsx`:

```tsx
import React, { useEffect } from 'react'
import { SafeAreaView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { scheduleStore } from '../src/lib/schedule-store'
import { ScheduleContent } from '../src/components/ScheduleContent'
import { useSplitLayout } from '../src/lib/use-split-layout'
import { colors } from '../src/constants/theme'

export default function ScheduleScreen() {
  const result = scheduleStore.get()
  const isSplit = useSplitLayout()

  useEffect(() => {
    if (isSplit || !result) {
      router.replace('/')
    }
  }, [isSplit, result])

  useEffect(() => {
    return () => scheduleStore.clear()
  }, [])

  if (isSplit || !result) return null

  return (
    <SafeAreaView style={styles.safe}>
      <ScheduleContent result={result} onBack={() => router.back()} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
})
```

- [ ] **Step 2: Verify mobile flow still works**

In the Expo dev server, narrow the browser below 768px (or use Expo Go on a device). Enter an address → confirm navigation to `/schedule` renders the dark schedule. Click "← Change address" → returns to home.

- [ ] **Step 3: Run all tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/schedule.tsx
git commit -m "feat: schedule.tsx — redirect on wide screens, use ScheduleContent"
```

---

### Task 11: Final verification and push

- [ ] **Step 1: Run full test suite**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 2: Full web flow verification**

Open http://localhost:8081 in a browser at full width (≥ 768px):
1. Loads with dark navy background, placeholder in right panel, no layout flash
2. Enter a valid US address → right panel shows schedule with pink gradient card and emoji badges
3. Click "← Change address" → right panel clears to placeholder, form inputs are empty
4. Enter an invalid address → navigates to address-not-found screen
5. Resize below 768px → collapses to single-column; enter address → navigates to `/schedule`

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```
