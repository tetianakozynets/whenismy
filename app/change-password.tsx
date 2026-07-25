import React, { useState } from 'react'
import {
  Text, TextInput, Pressable, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/auth-context'
import { changePassword } from '../src/lib/auth'
import { colors, spacing, radius } from '../src/constants/theme'

export default function ChangePasswordScreen() {
  const { user } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!user) return null

  async function handleSubmit() {
    setError(null)
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all fields.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const result = await changePassword(user!.email!, currentPassword, newPassword)
    setLoading(false)
    if (result.error) {
      setError(result.error)
      return
    }
    setSuccess(true)
    setTimeout(() => router.back(), 1500)
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backLink}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Change password</Text>

          <TextInput
            style={styles.input}
            placeholder="Current password"
            placeholderTextColor={colors.textSecondary}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            returnKeyType="next"
            testID="input-current-password"
          />
          <TextInput
            style={styles.input}
            placeholder="New password (min 8 characters)"
            placeholderTextColor={colors.textSecondary}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            returnKeyType="next"
            testID="input-new-password"
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            testID="input-confirm-password"
          />

          {error ? <Text style={styles.error} testID="error-message">{error}</Text> : null}
          {success ? <Text style={styles.success} testID="success-message">Password updated</Text> : null}

          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            testID="submit-button"
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Update password</Text>
            }
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { padding: spacing.lg, gap: spacing.md },
  backRow: { paddingBottom: spacing.sm },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  error: { color: colors.error, fontSize: 14 },
  success: { color: '#10B981', fontSize: 14 },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
