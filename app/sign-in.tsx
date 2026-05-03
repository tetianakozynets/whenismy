import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { signUp, signIn } from '../src/lib/auth'
import { colors, spacing, radius } from '../src/constants/theme'

export default function SignInScreen() {
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
    if (p.length < 12) { setError('Password must be at least 12 characters.'); return }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const { error: err } = await signUp(e, p)
        if (err) { setError(err.message); return }
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('signin')
      } else {
        const { error: err } = await signIn(e, p)
        if (err) { setError(err.message); return }
        router.back()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Never miss a pickup</Text>
          <Text style={styles.subtitle}>
            {mode === 'signup'
              ? 'Create an account to get reminders the night before.'
              : 'Sign in to manage your reminders.'}
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
            placeholder="Password (min 12 characters)"
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: spacing.lg, gap: 12, justifyContent: 'center' },
  backRow: { paddingBottom: spacing.md },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 28, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.md, fontSize: 16, backgroundColor: colors.card, color: colors.text,
  },
  error: { color: colors.error, fontSize: 14 },
  info: { color: '#10B981', fontSize: 14 },
  button: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  toggleRow: { alignItems: 'center', paddingVertical: spacing.sm },
  toggleText: { color: colors.primary, fontSize: 14 },
})
