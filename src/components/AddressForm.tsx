import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  onSubmit: (street: string, city: string, state: string) => void
  loading: boolean
}

const SUPPORTED_STATES = [
  { label: 'NJ',  value: 'NJ' },
  { label: 'NYC', value: 'NY' },
]

const NYC_CITY = 'New York City'

export function AddressForm({ onSubmit, loading }: Props) {
  const [street, setStreet] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState<string>('NJ')
  const [error, setError] = useState<string | null>(null)
  const isNYC = state === 'NY'

  function handleStateChange(value: string) {
    setState(value)
    setCity(value === 'NY' ? NYC_CITY : '')
  }

  function handleSubmit() {
    const s = street.trim()
    const c = city.trim()
    if (!s || !c) {
      setError('Please fill in all fields.')
      return
    }
    setError(null)
    onSubmit(s, c, state)
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
      {isNYC ? (
        <View style={styles.cityStatic} testID="input-city">
          <Text style={styles.cityStaticLabel}>City</Text>
          <Text style={styles.cityStaticValue}>{city}</Text>
        </View>
      ) : (
        <TextInput
          style={styles.input}
          placeholder="City"
          placeholderTextColor={colors.textSecondary}
          value={city}
          onChangeText={setCity}
          testID="input-city"
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />
      )}
      <View style={styles.stateRow}>
        {SUPPORTED_STATES.map(({ label, value }) => (
          <Pressable
            key={value}
            style={[styles.stateChip, state === value && styles.stateChipActive]}
            onPress={() => handleStateChange(value)}
            accessibilityRole="button"
            testID={`state-chip-${value}`}
          >
            <Text style={[styles.stateChipText, state === value && styles.stateChipTextActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.moreSoon}>More states coming soon</Text>
      </View>
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
  container: { gap: 12 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 16,
    backgroundColor: colors.card,
    color: colors.text,
  },
  stateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
  },
  stateChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  stateChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  stateChipTextActive: {
    color: '#fff',
  },
  moreSoon: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    flexShrink: 1,
    minWidth: 0,
  },
  cityStatic: { gap: 4 },
  cityStaticLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cityStaticValue: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
