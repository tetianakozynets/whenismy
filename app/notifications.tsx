import React, { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/auth-context'
import { getPreferences, updateNotificationPreferences } from '../src/lib/user-api'
import { NotificationToggle } from '../src/components/NotificationToggle'
import { colors, spacing, radius } from '../src/constants/theme'

const TIME_OPTIONS = ['18:00', '19:00', '20:00', '21:00', '22:00']
const TIME_LABELS: Record<string, string> = {
  '18:00': '6:00 PM', '19:00': '7:00 PM', '20:00': '8:00 PM',
  '21:00': '9:00 PM', '22:00': '10:00 PM',
}

export default function NotificationsScreen() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [garbage, setGarbage] = useState(true)
  const [recycling, setRecycling] = useState(true)
  const [yardWaste, setYardWaste] = useState(false)
  const [time, setTime] = useState('20:00')
  const [supportedTypes, setSupportedTypes] = useState<string[]>([])

  useEffect(() => {
    if (!user) return
    getPreferences(user.id).then(prefs => {
      if (prefs) {
        setGarbage(prefs.notifications_garbage)
        setRecycling(prefs.notifications_recycling)
        setYardWaste(prefs.notifications_yard_waste)
        setTime(prefs.notification_time ?? '20:00')
        setSupportedTypes(prefs.supported_event_types ?? [])
      }
      setLoading(false)
    })
  }, [user])

  async function handleSave() {
    if (!user) return
    setSaving(true)
    await updateNotificationPreferences(user.id, {
      notifications_garbage: garbage,
      notifications_recycling: recycling,
      notifications_yard_waste: yardWaste,
      notification_time: time,
    })
    setSaving(false)
    router.back()
  }

  if (!user) return null

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable onPress={() => router.back()} style={styles.backRow}>
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Reminders</Text>
        <Text style={styles.subtitle}>
          You'll get a notification the night before each pickup.
        </Text>

        {loading
          ? <ActivityIndicator testID="activity-indicator" color={colors.primary} style={{ marginTop: spacing.xl }} />
          : <>
              {(supportedTypes.length === 0 || supportedTypes.includes('garbage')) && (
                <NotificationToggle label="Garbage" icon="🗑️" value={garbage} onValueChange={setGarbage} />
              )}
              {(supportedTypes.length === 0 || supportedTypes.includes('recycling')) && (
                <NotificationToggle label="Recycling" icon="♻️" value={recycling} onValueChange={setRecycling} />
              )}
              {supportedTypes.includes('yard_waste') && (
                <NotificationToggle label="Yard Waste" icon="🍂" value={yardWaste} onValueChange={setYardWaste} />
              )}

              <Text style={styles.sectionLabel}>Reminder time</Text>
              <View style={styles.timeRow}>
                {TIME_OPTIONS.map(t => (
                  <Pressable
                    key={t}
                    style={[styles.timeChip, time === t && styles.timeChipSelected]}
                    onPress={() => setTime(t)}
                  >
                    <Text style={[styles.timeChipText, time === t && styles.timeChipTextSelected]}>
                      {TIME_LABELS[t]}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={[styles.button, saving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </>
        }
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
  sectionLabel: {
    fontSize: 11, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.md,
  },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeChip: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.card,
  },
  timeChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  timeChipText: { fontSize: 14, color: colors.textSecondary },
  timeChipTextSelected: { color: '#fff', fontWeight: '600' },
  button: {
    backgroundColor: colors.primary, padding: spacing.md,
    borderRadius: radius.sm, alignItems: 'center', marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
