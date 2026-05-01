import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors, spacing, radius } from '../constants/theme'
import { eventTypeLabel } from '../lib/formatting'
import { eventTypeIcon } from '../lib/event-icons'

interface Props {
  eventType: string
}

export function EventTypeBadge({ eventType }: Props) {
  const bgColor = (colors as Record<string, string>)[eventType] ?? colors.textSecondary
  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      <Text style={styles.emoji}>{eventTypeIcon(eventType)}</Text>
      <Text style={styles.label}>{eventTypeLabel(eventType)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
  },
  emoji: {
    fontSize: 12,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
})
