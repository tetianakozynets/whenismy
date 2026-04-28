import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, radius } from '../constants/theme'
import { eventTypeLabel } from '../lib/formatting'

interface Props {
  eventType: string
}

export function EventTypeBadge({ eventType }: Props) {
  const bgColor = (colors as Record<string, string>)[eventType] ?? colors.textSecondary
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={styles.label}>{eventTypeLabel(eventType)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
})
