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

    let addr: SavedAddress | null
    try {
      addr = await getSavedAddress()
    } catch {
      setSaved(false)
      return
    }
    if (!addr) { setSaved(false); return }
    setSaved(addr)

    // Manual schedules have no live source to refresh against — the
    // locally generated events are the source of truth.
    if (addr.manualSchedules || addr.place.provider === 'recollect-ical' || !isStale(addr.savedAt)) {
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
