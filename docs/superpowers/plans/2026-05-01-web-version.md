# Web Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Expo web output into a proper desktop experience: fix the color system to the original dark theme, add emoji icons to pickup type badges, and add a responsive split-panel layout for screens ≥ 768px wide.

**Architecture:** The split panel is rendered by `index.tsx` using a `useSplitLayout()` hook. On wide screens, lookup results are held in local React state and passed as props to `SchedulePanel`. On narrow screens, the existing navigation to `/schedule` is unchanged. `schedule.tsx` redirects to `/` on wide screens because the split panel already shows results there.

**Tech Stack:** Expo (React Native + web), `expo-linear-gradient` (new dep), `useWindowDimensions` from React Native, `@testing-library/react-native` for tests.

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

In `src/components/AddressForm.tsx`, add `color: colors.text` to the input style and add `placeholderTextColor` props so text is readable on the dark card background.

Replace the three `TextInput` elements and the `styles.input` block:

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

And update `styles.input`:

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

Open http://localhost:8081. Confirm: deep navy background, dark card inputs, pink button.

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

Expected: PASS — 5 tests

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

- [ ] **Step 3: Run badge tests to confirm they still pass**

```bash
npm test -- --testPathPattern=EventTypeBadge --watchAll=false
```

Expected: PASS — 4 tests (the label is still in its own Text node so `getByText('Garbage')` still works)

- [ ] **Step 4: Commit**

```bash
git add src/components/EventTypeBadge.tsx
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
import { View, Text, StyleSheet } from 'react-native'
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

- [ ] **Step 3: Start the app and verify the card looks correct**

```bash
npx expo start --web
```

Open http://localhost:8081, enter an address and look up a schedule. The "Next pickup" card should show a pink-to-red gradient with a large emoji above the badge.

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

Create `src/lib/use-split-layout.test.ts`:

```ts
import { renderHook } from '@testing-library/react-native'
import { useWindowDimensions } from 'react-native'
import { useSplitLayout } from './use-split-layout'

jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  useWindowDimensions: jest.fn(),
}))

const mockDimensions = useWindowDimensions as jest.Mock

it('returns true when width is exactly 768', () => {
  mockDimensions.mockReturnValue({ width: 768, height: 900 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(true)
})

it('returns true when width is greater than 768', () => {
  mockDimensions.mockReturnValue({ width: 1440, height: 900 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(true)
})

it('returns false when width is 767', () => {
  mockDimensions.mockReturnValue({ width: 767, height: 900 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(false)
})

it('returns false when width is 375 (iPhone)', () => {
  mockDimensions.mockReturnValue({ width: 375, height: 812 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(false)
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --testPathPattern=use-split-layout --watchAll=false
```

Expected: FAIL — `Cannot find module './use-split-layout'`

- [ ] **Step 3: Implement use-split-layout.ts**

Create `src/lib/use-split-layout.ts`:

```ts
import { useWindowDimensions } from 'react-native'
import { SPLIT_BREAKPOINT } from '../constants/theme'

export function useSplitLayout(): boolean {
  const { width } = useWindowDimensions()
  return width >= SPLIT_BREAKPOINT
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --testPathPattern=use-split-layout --watchAll=false
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/use-split-layout.ts src/lib/use-split-layout.test.ts
git commit -m "feat: add useSplitLayout hook (true when width >= 768)"
```

---

### Task 6: Create SplitLayout component

**Files:**
- Create: `src/components/SplitLayout.tsx`

- [ ] **Step 1: Create SplitLayout.tsx**

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

### Task 7: Create SchedulePanel component

**Files:**
- Create: `src/components/SchedulePanel.tsx`

- [ ] **Step 1: Create SchedulePanel.tsx**

Create `src/components/SchedulePanel.tsx`:

```tsx
import React from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { LookupResponse } from '../lib/types'
import { NextPickupCard } from './NextPickupCard'
import { ScheduleList } from './ScheduleList'
import { colors, spacing, radius } from '../constants/theme'

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

  const { events, place } = result

  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No upcoming pickups found.</Text>
        <Pressable onPress={onReset} accessibilityRole="button">
          <Text style={styles.backLink}>← Change address</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable onPress={onReset} style={styles.backRow} accessibilityRole="button">
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
  empty: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.md,
    justifyContent: 'center',
  },
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
git add src/components/SchedulePanel.tsx
git commit -m "feat: add SchedulePanel — schedule results or placeholder for split panel"
```

---

### Task 8: Refactor index.tsx to use split panel on wide screens

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: Replace app/index.tsx**

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
  }

  const formContent = (
    <>
      <Text style={styles.title}>whenIsMy</Text>
      <Text style={styles.subtitle}>
        Find your garbage and recycling pickup days
      </Text>
      <AddressForm onSubmit={handleLookup} loading={loading} />
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

- [ ] **Step 2: Test wide screen in browser**

```bash
npx expo start --web
```

Open http://localhost:8081 in a browser window wider than 768px. Verify:
- Left column (320px): title, subtitle, address form with dark inputs and pink button
- Right column: placeholder text "Enter your address on the left to see your schedule"
- Enter an address and submit — right panel shows the schedule without any page navigation
- Click "← Change address" — right panel returns to placeholder

Resize browser below 768px — confirm it collapses to single-column mobile layout.

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "feat: split panel on wide screens — results in right panel, mobile nav unchanged"
```

---

### Task 9: Update schedule.tsx to redirect on wide screens

**Files:**
- Modify: `app/schedule.tsx`

- [ ] **Step 1: Update schedule.tsx**

Replace the full contents of `app/schedule.tsx`:

```tsx
import React, { useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, StyleSheet, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { scheduleStore } from '../src/lib/schedule-store'
import { NextPickupCard } from '../src/components/NextPickupCard'
import { ScheduleList } from '../src/components/ScheduleList'
import { useSplitLayout } from '../src/lib/use-split-layout'
import { colors, spacing, radius } from '../src/constants/theme'

export default function ScheduleScreen() {
  const result = scheduleStore.get()
  const isSplit = useSplitLayout()

  useEffect(() => {
    if (isSplit || !result) {
      router.replace('/')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => scheduleStore.clear()
  }, [])

  if (isSplit || !result) return null

  const { events } = result

  if (events.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No upcoming pickups found.</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button">
            <Text style={styles.backLink}>← Change address</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.backRow} accessibilityRole="button">
          <Text style={styles.backLink}>← Change address</Text>
        </Pressable>
        {result.place.provider === 'nyc-dsny' && (
          <View style={styles.providerBadge}>
            <Text style={styles.providerText}>🗽 NYC official schedule</Text>
          </View>
        )}
        {result.place.provider === 'recollect-ical' && (
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
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
  empty: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  emptyText: { fontSize: 16, color: colors.textSecondary },
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

- [ ] **Step 2: Verify mobile flow still works**

In the running Expo dev server, open the app in a narrow browser window (< 768px) or on a device via Expo Go. Enter an address → confirm it navigates to `/schedule` and renders the dark-themed schedule screen. Click "← Change address" → returns to home.

- [ ] **Step 3: Run all tests**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/schedule.tsx
git commit -m "feat: redirect schedule.tsx to home on wide screens (split panel handles it)"
```

---

### Task 10: Final verification and push

- [ ] **Step 1: Run full test suite**

```bash
npm test -- --watchAll=false
```

Expected: all tests pass.

- [ ] **Step 2: Verify web on wide screen**

Open http://localhost:8081 in a browser at full width. Run through the full flow:
1. App loads — dark navy background, pink button, placeholder in right panel
2. Enter a valid US address → right panel shows schedule with pink gradient card and emoji icons
3. Click "← Change address" → right panel returns to placeholder, form is still visible
4. Enter an invalid/unfound address → navigates to address-not-found screen (correct on all viewport sizes)
5. Resize browser below 768px → collapses to single-column mobile layout

- [ ] **Step 3: Push to GitHub**

```bash
git push origin main
```
