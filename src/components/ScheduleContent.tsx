import React from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { LookupResponse } from '../lib/types'
import { NextPickupCard } from './NextPickupCard'
import { ScheduleList } from './ScheduleList'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  result: LookupResponse
  onBack: () => void
}

export function ScheduleContent({ result, onBack }: Props) {
  const { events = [], place } = result

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

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Pressable onPress={onBack} style={styles.backRow} accessibilityRole="button">
        <Text style={styles.backLink}>← Change address</Text>
      </Pressable>
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
      <NextPickupCard event={events[0]} />
      {events.length > 1 && (
        <>
          <Text style={styles.sectionHeader}>Upcoming</Text>
          <ScheduleList events={events} skipFirst />
        </>
      )}
      <Text style={styles.disclaimer}>
        Schedules may shift on public holidays — check your municipality's website.
      </Text>
      <Pressable style={styles.upsellBanner} accessibilityRole="button">
        <Text style={styles.upsellText}>
          Get reminders the night before pickup — Sign in →
        </Text>
      </Pressable>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  empty: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  emptyText: { fontSize: 16, color: colors.textSecondary },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  backRow: { paddingVertical: spacing.xs },
  backLink: { color: colors.primary, fontSize: 15 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
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
