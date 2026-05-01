import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LookupResponse } from '../lib/types'
import { ScheduleContent } from './ScheduleContent'
import { colors, spacing } from '../constants/theme'

interface Props {
  result: LookupResponse | null
  onReset: () => void
}

export function SchedulePanel({ result, onReset }: Props) {
  if (!result) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Enter your address on the left to see your schedule
        </Text>
      </View>
    )
  }

  return <ScheduleContent result={result} onBack={onReset} />
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
})
