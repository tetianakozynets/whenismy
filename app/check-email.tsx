import React, { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, SafeAreaView } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { WimLogo } from '../src/components/WimLogo'
import { useAuth } from '../src/lib/auth-context'
import { colors, spacing, radius } from '../src/constants/theme'

export default function CheckEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>()
  const { user } = useAuth()

  // Auto-redirect when the deep link confirms the email and signs the user in
  useEffect(() => {
    if (user) router.replace('/(tabs)/schedule')
  }, [user])

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <WimLogo titleSize={36} />

        <View style={styles.content}>
          <Text style={styles.emoji}>📬</Text>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.email}>{email}</Text>
          </Text>
          <Text style={styles.hint}>
            Click the link in the email to activate your account, then come back and sign in.
          </Text>
        </View>

        <Pressable
          style={styles.button}
          onPress={() => router.replace('/sign-in')}
          accessibilityRole="button"
          testID="btn-go-to-signin"
        >
          <Text style={styles.buttonText}>Go to sign in →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.xl,
    justifyContent: 'center',
  },
  content: {
    gap: spacing.md,
    alignItems: 'center',
  },
  emoji: { fontSize: 52 },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  email: {
    color: colors.text,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
