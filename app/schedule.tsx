import React, { useEffect } from 'react'
import {
  View, Text, ScrollView, Pressable, StyleSheet, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { scheduleStore } from '../src/lib/schedule-store'
import { NextPickupCard } from '../src/components/NextPickupCard'
import { ScheduleList } from '../src/components/ScheduleList'
import { colors, spacing } from '../src/constants/theme'

export default function ScheduleScreen() {
  const result = scheduleStore.get()

  useEffect(() => {
    return () => scheduleStore.clear()
  }, [])

  if (!result) {
    router.replace('/')
    return null
  }

  const { events } = result

  if (events.length === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No upcoming pickups found.</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>← Change address</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLink}>← Change address</Text>
        </Pressable>
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
        <Pressable style={styles.upsellBanner}>
          <Text style={styles.upsellText}>
            Get reminders the night before pickup — Sign in →
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  backRow: { paddingVertical: 4 },
  backLink: { color: colors.primary, fontSize: 15 },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  empty: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  emptyText: { fontSize: 16, color: colors.textSecondary },
  disclaimer: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  upsellBanner: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  upsellText: { color: '#fff', fontSize: 14, fontWeight: '500' },
})
