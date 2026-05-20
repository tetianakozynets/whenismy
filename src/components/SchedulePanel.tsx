import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LookupResponse } from '../lib/types'
import { ScheduleContent } from './ScheduleContent'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  result: LookupResponse | null
  onReset: () => void
  address?: string
  notFound?: boolean
  serviceUnavailable?: boolean
  errorMsg?: string | null
}

export function SchedulePanel({ result, onReset, address, notFound, serviceUnavailable, errorMsg }: Props) {
  if (result) {
    return <ScheduleContent key={result.place.address_key} result={result} onBack={onReset} address={address} />
  }

  if (notFound) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.notFoundText}>
          Please enter a valid address.
        </Text>
      </View>
    )
  }

  if (serviceUnavailable) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.notFoundTitle}>Temporarily unavailable</Text>
        <Text style={styles.notFoundText}>
          Schedule data for this address is temporarily unavailable. Please try again later.
        </Text>
      </View>
    )
  }

  if (errorMsg) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.notFoundText}>{errorMsg}</Text>
      </View>
    )
  }

  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>
        Enter your address on the left to see your schedule
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  placeholderText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  notFoundTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  notFoundText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
})
