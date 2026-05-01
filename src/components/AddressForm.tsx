import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  onSubmit: (street: string, city: string, state: string) => void
  loading: boolean
}

export function AddressForm({ onSubmit, loading }: Props) {
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit() {
    const s = street.trim()
    const c = city.trim()
    const st = state.trim()
    if (!s || !c || !st) {
      setError('Please fill in all fields.')
      return
    }
    if (!/^[A-Za-z]{2}$/.test(st)) {
      setError('State must be a 2-letter abbreviation (e.g. NY).')
      return
    }
    setError(null)
    onSubmit(s, c, st.toUpperCase())
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Street address"
        placeholderTextColor={colors.textSecondary}
        value={street}
        onChangeText={setStreet}
        testID="input-street"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <TextInput
        style={styles.input}
        placeholder="City"
        placeholderTextColor={colors.textSecondary}
        value={city}
        onChangeText={setCity}
        testID="input-city"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <TextInput
        style={styles.input}
        placeholder="State (e.g. NY)"
        placeholderTextColor={colors.textSecondary}
        value={state}
        onChangeText={setState}
        testID="input-state"
        maxLength={2}
        autoCapitalize="characters"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />
      {error ? (
        <Text style={styles.error} testID="form-error">{error}</Text>
      ) : null}
      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
        testID="submit-button"
        accessibilityRole="button"
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.buttonText}>Look up my schedule</Text>
        }
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
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
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
