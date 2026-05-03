import React, { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { LookupResponse, PickupEvent } from '../lib/types'
import { NextPickupCard } from './NextPickupCard'
import { ScheduleList } from './ScheduleList'
import { daysUntil } from '../lib/formatting'
import { colors, spacing, radius } from '../constants/theme'
import { useAuth } from '../lib/auth-context'

interface Props {
  result: LookupResponse
  onBack: () => void
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

export function ScheduleContent({ result, onBack }: Props) {
  const { events = [], place } = result
  const [showAll, setShowAll] = useState(false)
  const { user } = useAuth()

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
  const firstDayEvents = grouped.get(dates[0]) ?? []
  const remainingEvents = dates.slice(1).flatMap(d => grouped.get(d) ?? [])

  const thisWeek = remainingEvents.filter(e => daysUntil(e.date) <= 7)
  const hasMore = remainingEvents.some(e => daysUntil(e.date) > 7)
  const listEvents = showAll ? remainingEvents : thisWeek

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} accessibilityRole="button">
          <Text style={styles.backLink}>← Change address</Text>
        </Pressable>
        {user && (
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button">
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
      <NextPickupCard events={firstDayEvents} />
      {listEvents.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>This week</Text>
          <ScheduleList events={listEvents} />
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
      <Text style={styles.disclaimer}>
        Schedules may shift on public holidays — check your municipality's website.
      </Text>
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
})
