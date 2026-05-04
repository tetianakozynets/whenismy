import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { PickupEvent } from '../lib/types'
import { EventTypeBadge } from './EventTypeBadge'
import { eventTypeIcon } from '../lib/event-icons'
import { formatPickupDate, daysUntil, daysUntilLabel } from '../lib/formatting'
import { spacing, radius } from '../constants/theme'

interface Props {
  events: PickupEvent[]
  todayNote?: string
}

export function NextPickupCard({ events, todayNote }: Props) {
  const first = events[0]
  const days = daysUntil(first.date)
  return (
    <LinearGradient
      colors={['#e94560', '#c0392b']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.emojiRow}>
        {events.map(e => (
          <Text key={e.event_type} style={styles.bigEmoji}>{eventTypeIcon(e.event_type)}</Text>
        ))}
      </View>
      <Text style={styles.eyebrow}>Next pickup</Text>
      <View style={styles.badges}>
        {events.map(e => (
          <EventTypeBadge key={e.event_type} eventType={e.event_type} />
        ))}
      </View>
      <Text style={styles.date}>{formatPickupDate(first.date)}</Text>
      <Text style={styles.countdown}>{daysUntilLabel(days)}</Text>
      {todayNote && (
        <View style={styles.holidayNote}>
          <Text style={styles.holidayNoteText}>🏛 {todayNote}</Text>
        </View>
      )}
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  date: { fontSize: 18, fontWeight: '600', color: '#FFFFFF' },
  countdown: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  holidayNote: {
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 6,
    padding: 8,
  },
  holidayNoteText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 16,
  },
})
