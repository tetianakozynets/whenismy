import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import { PickupEvent } from '../lib/types'
import { colors, spacing, radius, SPLIT_BREAKPOINT } from '../constants/theme'
import { eventTypeIcon } from '../lib/event-icons'

interface Props {
  events: PickupEvent[]
}

const DOW_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const EVENT_SHORT_LABELS: Record<string, string> = {
  garbage: 'Garbage',
  recycling: 'Recycling',
  yard_waste: 'Yard Waste',
  organics: 'Composting',
  bulk_waste: 'Large Items',
}

function eventColor(type: string): string {
  return (colors as Record<string, string>)[type] ?? colors.textSecondary
}

function buildMonthMap(events: PickupEvent[], year: number, month: number): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const e of events) {
    const d = new Date(e.date + 'T12:00:00')
    if (d.getFullYear() === year && d.getMonth() === month) {
      const list = map.get(e.date) ?? []
      if (!list.includes(e.event_type)) list.push(e.event_type)
      map.set(e.date, list)
    }
  }
  return map
}

function getMonthCells(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function pad(n: number) { return String(n).padStart(2, '0') }

export function PickupCalendar({ events }: Props) {
  const today = new Date()
  const { width } = useWindowDimensions()
  const isWide = width >= SPLIT_BREAKPOINT

  const [viewMonth, setViewMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  )

  const year = viewMonth.getFullYear()
  const month = viewMonth.getMonth()
  const monthMap = buildMonthMap(events, year, month)
  const cells = getMonthCells(year, month)
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} style={styles.navBtn}>
          <Text style={styles.navText}>‹</Text>
        </Pressable>
        <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
        <Pressable onPress={() => setViewMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} style={styles.navBtn}>
          <Text style={styles.navText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        {DOW_HEADERS.map(h => (
          <View key={h} style={styles.cell}>
            <Text style={styles.dowText}>{h}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={[styles.cell, styles.gridCell, isWide ? styles.cellWide : styles.cellNarrow]} />
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`
            const dayEvents = monthMap.get(dateStr) ?? []
            const isToday = dateStr === todayStr

            return (
              <View key={di} style={[styles.cell, styles.gridCell, isWide ? styles.cellWide : styles.cellNarrow]}>
                <View style={[styles.dayCircle, isToday && styles.todayCircle]}>
                  <Text style={[styles.dayText, isToday && styles.todayText]}>{day}</Text>
                </View>

                {isWide ? (
                  // Web: colored pill with emoji + label
                  <View style={styles.pillsCol}>
                    {dayEvents.map(type => (
                      <View key={type} style={[styles.pill, { backgroundColor: eventColor(type) }]}>
                        <Text style={styles.pillText} numberOfLines={1}>
                          {eventTypeIcon(type)} {EVENT_SHORT_LABELS[type] ?? type}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  // Mobile: small colored badge with emoji only
                  <View style={styles.badgeRow}>
                    {dayEvents.map(type => (
                      <View key={type} style={[styles.badge, { backgroundColor: eventColor(type) }]}>
                        <Text style={styles.badgeEmoji}>{eventTypeIcon(type)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )
          })}
        </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  monthLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  navBtn: { padding: spacing.sm },
  navText: { fontSize: 22, color: colors.primary, fontWeight: '600' },
  row: { flexDirection: 'row' },
  grid: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  gridCell: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cell: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  cellNarrow: { minHeight: 58 },
  cellWide: { minHeight: 70 },
  dowText: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', paddingBottom: spacing.xs,
  },
  dayCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  todayCircle: { backgroundColor: colors.primary },
  dayText: { fontSize: 13, color: colors.text },
  todayText: { color: '#fff', fontWeight: '700' },

  // Web: pill style
  pillsCol: { width: '100%', gap: 2, marginTop: 3 },
  pill: {
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
    width: '100%',
  },
  pillText: { fontSize: 10, color: '#fff', fontWeight: '500' },

  // Mobile: badge style
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, marginTop: 3, justifyContent: 'center' },
  badge: { width: 20, height: 20, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 11 },
})
