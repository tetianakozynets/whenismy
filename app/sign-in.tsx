import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { signUp, signIn } from '../src/lib/auth'
import { WimLogo } from '../src/components/WimLogo'
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
  const insets = useSafeAreaInsets()
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
    if (p.length < 8) { setError('Password must be at least 8 characters.'); return }

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
          style={[styles.hero, { paddingTop: insets.top + spacing.xl }]}
        >
          <Pressable onPress={() => router.back()} style={[styles.backRow, { top: insets.top + spacing.sm }]}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
          <WimLogo />
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
            placeholder="Password (min 8 characters)"
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
    paddingBottom: spacing.xl,
    gap: spacing.md,
    minHeight: 280,
  },
  backRow: { position: 'absolute', left: spacing.lg },
  backLink: { color: colors.primary, fontSize: 15 },
  heroTagline: { fontSize: 16, color: colors.text, fontWeight: '500' },
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
