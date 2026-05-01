import React from 'react'
import { Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { PickupEvent } from '../lib/types'
import { EventTypeBadge } from './EventTypeBadge'
import { eventTypeIcon } from '../lib/event-icons'
import { formatPickupDate, daysUntil, daysUntilLabel } from '../lib/formatting'
import { spacing, radius } from '../constants/theme'

interface Props {
  event: PickupEvent
}

export function NextPickupCard({ event }: Props) {
  const days = daysUntil(event.date)
  return (
    <LinearGradient
      colors={['#e94560', '#c0392b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.bigEmoji}>{eventTypeIcon(event.event_type)}</Text>
      <Text style={styles.eyebrow}>Next pickup</Text>
      <EventTypeBadge eventType={event.event_type} />
      <Text style={styles.date}>{formatPickupDate(event.date)}</Text>
      <Text style={styles.countdown}>{daysUntilLabel(days)}</Text>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bigEmoji: {
    fontSize: 28,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  date: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  countdown: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
})
