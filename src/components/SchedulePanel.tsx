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
}

export function SchedulePanel({ result, onReset, address, notFound }: Props) {
  if (result) {
    return <ScheduleContent result={result} onBack={onReset} address={address} />
  }

  if (notFound) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.notFoundTitle}>Address not found</Text>
        <Text style={styles.notFoundText}>
          We couldn't find that address. Please double-check the spelling and try a valid US address.
        </Text>
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
