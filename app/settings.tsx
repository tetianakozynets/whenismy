import React, { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, SafeAreaView, Alert, ActivityIndicator, ScrollView,
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

  function handleDeleteAccount() {
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
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Address</Text>
          {loading
            ? <ActivityIndicator color={colors.primary} />
            : <Text style={styles.valueText}>
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
          <Text style={styles.valueText}>{user.email}</Text>
        </View>

        <Pressable style={styles.row} onPress={handleSignOut}>
          <Text style={styles.rowLabel}>Sign out</Text>
        </Pressable>

        <Pressable style={styles.row} onPress={handleDeleteAccount}>
          <Text style={[styles.rowLabel, styles.danger]}>Delete account</Text>
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
  section: { gap: spacing.xs },
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  valueText: { fontSize: 15, color: colors.text },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  rowLabel: { fontSize: 16, color: colors.text },
  rowArrow: { fontSize: 20, color: colors.textSecondary },
  danger: { color: colors.error },
})
