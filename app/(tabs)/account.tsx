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
import { UserPreferences } from '../../src/lib/types'
import { colors, spacing, radius } from '../../src/constants/theme'
import { toTitleCase } from '../../src/lib/formatting'

export default function AccountTab() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getPreferences(user.id).then(p => { setPrefs(p); setLoading(false) })
  }, [user])

  async function handleSignOut() {
    try {
      await signOut()
      router.replace('/')
    } catch {
      Alert.alert('Error', 'Could not sign out. Please try again.')
    }
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
            try {
              await deleteAccount()
              router.replace('/')
              signOut().catch(() => {})
            } catch {
              Alert.alert('Error', 'Could not delete account. Please try again.')
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
    if (!prefs?.street) return 'None saved'
    return `${toTitleCase(prefs.street)}, ${toTitleCase(prefs.city)}, ${prefs.state.toUpperCase()}`
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

            <View style={styles.emailCard}>
              <Text style={styles.emailLabel}>Signed in as</Text>
              <Text style={styles.emailText}>{user.email}</Text>
            </View>
          </>
        )}

        <Pressable style={styles.row} onPress={handleSignOut} accessibilityRole="button">
          <Text style={styles.rowText}>Sign out</Text>
        </Pressable>

        <Pressable style={styles.deleteRow} onPress={handleDeleteAccount} accessibilityRole="button">
          <Text style={styles.deleteText}>Delete account</Text>
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
  deleteRow: {
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  deleteText: { fontSize: 13, color: colors.error },
})
