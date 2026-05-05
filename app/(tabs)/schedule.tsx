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
    setResult(null)
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
