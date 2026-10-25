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
    getSavedAddress()
      .then(addr => setSaved(addr ?? false))
      .catch(() => setSaved(false))
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
