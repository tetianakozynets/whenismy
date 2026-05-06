import React, { useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/auth-context'
import { saveManualSchedules, generateEventsFromManual } from '../src/lib/manual-schedule'
import { scheduleStore } from '../src/lib/schedule-store'
import { ManualScheduleInput } from '../src/lib/types'
import { colors, spacing, radius } from '../src/constants/theme'

const EVENT_TYPES = [
  { key: 'garbage' as const, label: 'Garbage', icon: '🗑️' },
  { key: 'recycling' as const, label: 'Recycling', icon: '♻️' },
  { key: 'yard_waste' as const, label: 'Yard Waste', icon: '🍂' },
]

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const
type Day = typeof DAYS[number]
const DAY_LABELS: Record<Day, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

interface TypeState {
  enabled: boolean
  day: Day
  frequency: 'weekly' | 'biweekly'
  anchorDate: string | null
}

const defaultState = (): TypeState => ({
  enabled: false, day: 'monday', frequency: 'weekly', anchorDate: null,
})

export default function ManualEntryScreen() {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [state, setState] = useState<Record<string, TypeState>>({
    garbage: defaultState(),
    recycling: defaultState(),
    yard_waste: defaultState(),
  })

  function update(type: string, patch: Partial<TypeState>) {
    setState(s => ({ ...s, [type]: { ...s[type], ...patch } }))
  }

  async function handleSave() {
    if (!user) { router.push('/sign-in'); return }
    const schedules: ManualScheduleInput[] = EVENT_TYPES
      .filter(t => state[t.key].enabled)
      .map(t => ({
        event_type: t.key,
        pickup_day: state[t.key].day,
        frequency: state[t.key].frequency,
        anchor_date: state[t.key].frequency === 'biweekly' ? state[t.key].anchorDate : null,
      }))

    if (schedules.length === 0) return

    setSaving(true)
    try {
      await saveManualSchedules(user.id, schedules)
      const events = schedules.flatMap(s => generateEventsFromManual(s))
      events.sort((a, b) => a.date.localeCompare(b.date))
      scheduleStore.set(
        {
          place: {
            address_key: 'manual||',
            recollect_place_id: null,
            latitude: null,
            longitude: null,
            timezone: null,
            supported_event_types: schedules.map(s => s.event_type),
            provider: null,
          },
          events,
        },
        '', '', ''
      )
      router.replace('/(tabs)/schedule')
    } catch {
      Alert.alert('Error', 'Could not save your schedule. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Enter your pickup days</Text>
        <Text style={styles.subtitle}>
          Tell us when your pickups happen and we'll remind you the night before.
        </Text>

        {EVENT_TYPES.map(({ key, label, icon }) => {
          const s = state[key]
          return (
            <View key={key} style={styles.card}>
              <Pressable style={styles.cardHeader} onPress={() => update(key, { enabled: !s.enabled })}>
                <Text style={styles.cardIcon}>{icon}</Text>
                <Text style={styles.cardLabel}>{label}</Text>
                <View style={[styles.togglePill, s.enabled && styles.togglePillOn]}>
                  <Text style={styles.togglePillText}>{s.enabled ? 'On' : 'Off'}</Text>
                </View>
              </Pressable>

              {s.enabled && (
                <View style={styles.cardBody}>
                  <Text style={styles.fieldLabel}>Pickup day</Text>
                  <View style={styles.chipRow}>
                    {DAYS.map(d => (
                      <Pressable
                        key={d}
                        style={[styles.chip, s.day === d && styles.chipSelected]}
                        onPress={() => update(key, { day: d })}
                      >
                        <Text style={[styles.chipText, s.day === d && styles.chipTextSelected]}>
                          {DAY_LABELS[d]}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Frequency</Text>
                  <View style={styles.chipRow}>
                    {(['weekly', 'biweekly'] as const).map(f => (
                      <Pressable
                        key={f}
                        style={[styles.chip, s.frequency === f && styles.chipSelected]}
                        onPress={() => update(key, { frequency: f })}
                      >
                        <Text style={[styles.chipText, s.frequency === f && styles.chipTextSelected]}>
                          {f === 'weekly' ? 'Every week' : 'Every 2 weeks'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {s.frequency === 'biweekly' && (
                    <View style={styles.anchorBox}>
                      <Text style={styles.fieldLabel}>Next pickup date</Text>
                      <Text style={styles.anchorHint}>
                        Tap to use today as anchor — or edit to set a specific upcoming {label.toLowerCase()} date (YYYY-MM-DD).
                      </Text>
                      <Pressable
                        style={styles.dateInput}
                        onPress={() => {
                          const today = new Date()
                          const pad = (n: number) => String(n).padStart(2, '0')
                          update(key, {
                            anchorDate: `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
                          })
                        }}
                      >
                        <Text style={styles.dateInputText}>
                          {s.anchorDate ?? 'Tap to set anchor date'}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
          )
        })}

        <Pressable
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Save my schedule</Text>
          }
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, gap: spacing.md },
  backRow: { paddingBottom: spacing.sm },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  card: { backgroundColor: colors.card, borderRadius: radius.md, overflow: 'hidden' },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
  },
  cardIcon: { fontSize: 20 },
  cardLabel: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' },
  togglePill: {
    paddingHorizontal: spacing.sm, paddingVertical: 4,
    borderRadius: radius.sm, backgroundColor: colors.border,
  },
  togglePillOn: { backgroundColor: colors.primary },
  togglePillText: { fontSize: 12, color: '#fff', fontWeight: '600' },
  cardBody: { padding: spacing.md, paddingTop: 0, gap: spacing.sm },
  fieldLabel: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm, paddingVertical: 6,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, color: colors.textSecondary },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  anchorBox: { gap: spacing.xs },
  anchorHint: { fontSize: 12, color: colors.textSecondary },
  dateInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.md, backgroundColor: colors.background,
  },
  dateInputText: { color: colors.text, fontSize: 14 },
  button: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center', marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
