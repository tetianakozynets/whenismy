import React from 'react'
import { View, Text, FlatList, StyleSheet } from 'react-native'
import { PickupEvent } from '../lib/types'
import { EventTypeBadge } from './EventTypeBadge'
import { formatPickupDate, daysUntil, daysUntilLabel } from '../lib/formatting'
import { HolidayMap } from '../lib/holidays'
import { colors, spacing } from '../constants/theme'

const EVENT_TYPE_LABELS: Record<string, string> = {
  garbage: 'Garbage',
  recycling: 'Recycling',
  yard_waste: 'Yard Waste',
  organics: 'Composting',
  bulk_waste: 'Bulk Items',
}

interface DayGroup {
  date: string
  events: PickupEvent[]
}

interface Props {
  events: PickupEvent[]
  skipFirst?: boolean
  holidays?: HolidayMap
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

export function ScheduleList({ events, skipFirst = false, holidays }: Props) {
  const groups = groupByDate(events)
  const displayed = skipFirst ? groups.slice(1) : groups
  return (
    <FlatList
      data={displayed}
      keyExtractor={g => g.date}
      scrollEnabled={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item, index }) => (
        <ScheduleDay group={item} isFirst={index === 0} holidayName={holidays?.get(item.date)} />
      )}
    />
  )
}

function ScheduleDay({ group, isFirst, holidayName }: { group: DayGroup; isFirst: boolean; holidayName?: string }) {
  const days = daysUntil(group.date)
  const typeLabels = group.events.map(e => EVENT_TYPE_LABELS[e.event_type] ?? e.event_type).join(', ')
  return (
    <View style={[styles.row, holidayName ? styles.rowHoliday : isFirst ? styles.rowAccent : styles.rowMuted]}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatPickupDate(group.date)}</Text>
        <Text style={[styles.countdown, !holidayName && isFirst && styles.countdownAccent]}>
          {daysUntilLabel(days)}
        </Text>
      </View>
      {holidayName ? (
        <Text style={styles.holidayAdvisory}>
          🏛 {holidayName} — {typeLabels} pickup may be cancelled. Check your township's website.
        </Text>
      ) : (
        <View style={styles.badges}>
          {group.events.map(e => (
            <EventTypeBadge key={e.event_type} eventType={e.event_type} />
          ))}
        </View>
      )}
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
  rowHoliday: {
    borderLeftColor: '#92400e',
  },
  holidayAdvisory: {
    fontSize: 12,
    color: '#92400e',
    fontStyle: 'italic',
    lineHeight: 17,
  },
})
