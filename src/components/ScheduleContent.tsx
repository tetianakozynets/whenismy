import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import { router } from 'expo-router'
import { LookupResponse, PickupEvent } from '../lib/types'
import { NextPickupCard } from './NextPickupCard'
import { ScheduleList } from './ScheduleList'
import { PickupCalendar } from './PickupCalendar'
import { daysUntil } from '../lib/formatting'
import { getUSHolidays, todayHolidayNote, HolidayMap } from '../lib/holidays'
import { colors, spacing, radius, SPLIT_BREAKPOINT } from '../constants/theme'
import { useAuth } from '../lib/auth-context'

interface Props {
  result: LookupResponse
  onBack: () => void
  address?: string
}

function groupByDate(events: PickupEvent[]): Map<string, PickupEvent[]> {
  const map = new Map<string, PickupEvent[]>()
  for (const e of events) {
    const group = map.get(e.date) ?? []
    group.push(e)
    map.set(e.date, group)
  }
  return map
}

export function ScheduleContent({ result, onBack, address }: Props) {
  const { events = [], place } = result
  const [showAll, setShowAll] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [holidays, setHolidays] = useState<HolidayMap>(new Map())
  const { user } = useAuth()
  const { width } = useWindowDimensions()
  const isWide = width >= SPLIT_BREAKPOINT

  useEffect(() => {
    getUSHolidays().then(setHolidays)
  }, [])

  if (events.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No upcoming pickups found.</Text>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.backLink}>← Change address</Text>
        </Pressable>
      </View>
    )
  }

  const grouped = groupByDate(events)
  const dates = Array.from(grouped.keys())

  // Skip holiday dates for the hero card — find the first non-holiday pickup
  const holidayDates = new Set(dates.filter(d => holidays.size && holidays.has(d)))
  const heroDate = dates.find(d => !holidayDates.has(d)) ?? dates[0]
  const firstDayEvents = grouped.get(heroDate) ?? []

  // If we skipped a holiday before the hero date, surface it as an advisory on the card
  const skippedHolidayDate = heroDate !== dates[0] ? dates[0] : undefined
  const skippedHoliday = skippedHolidayDate ? {
    date: skippedHolidayDate,
    name: holidays.get(skippedHolidayDate)!,
    events: grouped.get(skippedHolidayDate) ?? [],
  } : undefined

  const remainingEvents = dates.filter(d => d !== heroDate).flatMap(d => grouped.get(d) ?? [])

  const thisWeek = remainingEvents.filter(e => daysUntil(e.date) <= 7)
  const hasMore = remainingEvents.some(e => daysUntil(e.date) > 7)
  const listEvents = showAll ? remainingEvents : thisWeek

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        {!isWide && (
          <Pressable onPress={onBack} accessibilityRole="button">
            <Text style={styles.backLink}>← Change address</Text>
          </Pressable>
        )}
        {user && (
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" style={isWide && styles.gearRight}>
            <Text style={styles.gear}>⚙️</Text>
          </Pressable>
        )}
      </View>
      {place.provider === 'nyc-dsny' && (
        <View style={styles.providerBadge}>
          <Text style={styles.providerText}>🗽 NYC official schedule</Text>
        </View>
      )}
      {place.provider === 'recollect-ical' && (
        <View style={styles.providerBadge}>
          <Text style={styles.providerText}>📅 Calendar subscription</Text>
        </View>
      )}
      {address ? <Text style={styles.addressLabel}>{address}</Text> : null}
      <NextPickupCard events={firstDayEvents} todayNote={todayHolidayNote(holidays)} skippedHoliday={skippedHoliday} />
      {listEvents.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>This week</Text>
          <ScheduleList events={listEvents} holidays={holidays} />
        </>
      )}
      {hasMore && (
        <Pressable
          style={styles.showMoreButton}
          onPress={() => setShowAll(v => !v)}
          accessibilityRole="button"
        >
          <Text style={styles.showMoreText}>
            {showAll ? 'Show less' : 'Show full schedule'}
          </Text>
        </Pressable>
      )}
      {isWide ? (
        <>
          <Text style={styles.sectionHeader}>This month</Text>
          <PickupCalendar events={events} holidays={holidays} />
        </>
      ) : (
        <>
          <Pressable
            style={styles.calendarToggle}
            onPress={() => setShowCalendar(v => !v)}
            accessibilityRole="button"
          >
            <Text style={styles.calendarToggleText}>
              {showCalendar ? 'Hide calendar' : '📅 See in calendar'}
            </Text>
          </Pressable>
          {showCalendar && (
            <>
              <Text style={styles.sectionHeader}>This month</Text>
              <PickupCalendar events={events} holidays={holidays} />
            </>
          )}
        </>
      )}
      {!user && (
        <Pressable
          style={styles.upsellBanner}
          onPress={() => router.push('/sign-in')}
          accessibilityRole="button"
        >
          <Text style={styles.upsellText}>
            Get reminders the night before pickup — Sign in →
          </Text>
        </Pressable>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  empty: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  emptyText: { fontSize: 16, color: colors.textSecondary },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  backLink: { color: colors.primary, fontSize: 15 },
  gear: { fontSize: 20 },
  gearRight: { marginLeft: 'auto' },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  showMoreButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  showMoreText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  calendarToggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
  },
  calendarToggleText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
  upsellBanner: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  upsellText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  providerBadge: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  providerText: { fontSize: 12, color: colors.textSecondary },
  addressLabel: { fontSize: 13, color: colors.textSecondary },
})
