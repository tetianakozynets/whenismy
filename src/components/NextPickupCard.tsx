import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { PickupEvent } from '../lib/types'
import { EventTypeBadge } from './EventTypeBadge'
import { formatPickupDate, daysUntil, daysUntilLabel } from '../lib/formatting'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  event: PickupEvent
}

export function NextPickupCard({ event }: Props) {
  const days = daysUntil(event.date)
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Next pickup</Text>
      <EventTypeBadge eventType={event.event_type} />
      <Text style={styles.date}>{formatPickupDate(event.date)}</Text>
      <Text style={styles.countdown}>{daysUntilLabel(days)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  date: { fontSize: 18, fontWeight: '600', color: colors.text },
  countdown: { fontSize: 14, color: colors.textSecondary },
})
