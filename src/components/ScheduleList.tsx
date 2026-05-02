import React from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { PickupEvent } from '../lib/types'
import { EventTypeBadge } from './EventTypeBadge'
import { formatPickupDate, daysUntil, daysUntilLabel } from '../lib/formatting'
import { colors, spacing } from '../constants/theme'

interface DayGroup {
  date: string
  events: PickupEvent[]
}

interface Props {
  events: PickupEvent[]
  skipFirst?: boolean
}

function groupByDate(events: PickupEvent[]): DayGroup[] {
  const map = new Map<string, PickupEvent[]>()
  for (const e of events) {
    const group = map.get(e.date) ?? []
    group.push(e)
    map.set(e.date, group)
  }
  return Array.from(map.entries()).map(([date, evs]) => ({ date, events: evs }))
}

export function ScheduleList({ events, skipFirst = false }: Props) {
  const groups = groupByDate(events)
  const displayed = skipFirst ? groups.slice(1) : groups
  return (
    <FlatList
      data={displayed}
      keyExtractor={g => g.date}
      scrollEnabled={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item, index }) => <ScheduleDay group={item} isFirst={index === 0} />}
    />
  )
}

function ScheduleDay({ group, isFirst }: { group: DayGroup; isFirst: boolean }) {
  const days = daysUntil(group.date)
  return (
    <View style={[styles.row, isFirst ? styles.rowAccent : styles.rowMuted]}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatPickupDate(group.date)}</Text>
        <Text style={[styles.countdown, isFirst && styles.countdownAccent]}>
          {daysUntilLabel(days)}
        </Text>
      </View>
      <View style={styles.badges}>
        {group.events.map(e => (
          <EventTypeBadge key={e.event_type} eventType={e.event_type} />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingLeft: spacing.md - 3,
    gap: spacing.xs,
    borderLeftWidth: 3,
  },
  rowAccent: {
    borderLeftColor: colors.primary,
  },
  rowMuted: {
    borderLeftColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  date: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  countdown: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  countdownAccent: {
    color: colors.primary,
    fontWeight: '500',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
})
