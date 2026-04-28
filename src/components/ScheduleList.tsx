import React from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { PickupEvent } from '../lib/types'
import { EventTypeBadge } from './EventTypeBadge'
import { formatPickupDate, daysUntil, daysUntilLabel } from '../lib/formatting'
import { colors, spacing } from '../constants/theme'

interface Props {
  events: PickupEvent[]
  skipFirst?: boolean
}

export function ScheduleList({ events, skipFirst = false }: Props) {
  const displayed = skipFirst ? events.slice(1) : events
  return (
    <FlatList
      data={displayed}
      keyExtractor={e => `${e.date}-${e.event_type}`}
      scrollEnabled={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => <ScheduleRow event={item} />}
    />
  )
}

function ScheduleRow({ event }: { event: PickupEvent }) {
  const days = daysUntil(event.date)
  return (
    <View style={styles.row}>
      <EventTypeBadge eventType={event.event_type} />
      <View style={styles.dateBlock}>
        <Text style={styles.date}>{formatPickupDate(event.date)}</Text>
        <Text style={styles.countdown}>{daysUntilLabel(days)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateBlock: { flex: 1 },
  date: { fontSize: 15, color: colors.text },
  countdown: { fontSize: 13, color: colors.textSecondary },
  separator: { height: 1, backgroundColor: colors.border },
})
