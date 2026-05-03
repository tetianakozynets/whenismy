import React from 'react'
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/auth-context'
import { colors, spacing, radius } from '../src/constants/theme'

export default function AddressNotFoundScreen() {
  const { user } = useAuth()

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
          onPress={() => user ? router.push('/manual-entry') : router.push('/sign-in')}
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
          Sign in to save your schedule and get pickup reminders.
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
