import React, { useEffect, useState } from 'react'
import {
  View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useAuth } from '../src/lib/auth-context'
import { getPreferences, updateNotificationPreferences } from '../src/lib/user-api'
import { NotificationToggle } from '../src/components/NotificationToggle'
import { TimePicker } from '../src/components/TimePicker'
import { colors, spacing, radius } from '../src/constants/theme'

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

        {loading
          ? <ActivityIndicator testID="activity-indicator" color={colors.primary} style={{ marginTop: spacing.xl }} />
          : <>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  🔔 You'll receive a push notification the evening before each pickup day.
                </Text>
              </View>

              <Text style={styles.sectionLabel}>What to remind me about</Text>
              {(supportedTypes.length === 0 || supportedTypes.includes('garbage')) && (
                <NotificationToggle label="Garbage" icon="🗑️" value={garbage} onValueChange={setGarbage} />
              )}
              {(supportedTypes.length === 0 || supportedTypes.includes('recycling')) && (
                <NotificationToggle label="Recycling" icon="♻️" value={recycling} onValueChange={setRecycling} />
              )}
              {supportedTypes.includes('yard_waste') && (
                <NotificationToggle label="Yard Waste" icon="🍂" value={yardWaste} onValueChange={setYardWaste} />
              )}

              <Text style={styles.sectionLabel}>Remind me the evening before at</Text>
              <TimePicker value={time} onChange={setTime} />

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
  infoBox: {
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    padding: spacing.md,
  },
  infoText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
