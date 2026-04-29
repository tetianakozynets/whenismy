import React, { useState } from 'react'
import {
  View, Text, TextInput, Pressable, StyleSheet, SafeAreaView, ScrollView, Linking,
} from 'react-native'
import { router } from 'expo-router'
import { lookupByCalendarUrl, isError } from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'
import { colors, spacing, radius } from '../src/constants/theme'

const HELP_URL = 'https://support.recollect.net/hc/en-us/articles/360039222532'

export default function CalendarUrlScreen() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Please paste your calendar URL.')
      return
    }
    if (!trimmed.includes('recollect') || !trimmed.includes('/places/')) {
      setError("This doesn't look like a Recollect calendar URL. It should contain \"/places/\".")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await lookupByCalendarUrl(trimmed)
      if (isError(result)) {
        setError(result.error)
        return
      }
      scheduleStore.set(result)
      router.push('/schedule')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backRow} accessibilityRole="button">
          <Text style={styles.backLink}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Paste your calendar URL</Text>
        <Text style={styles.body}>
          {'1. Go to your city\'s waste schedule website and search for your address.\n' +
           '2. Tap "Get a calendar" or "Subscribe to your schedule".\n' +
           '3. Copy the URL that appears and paste it below.'}
        </Text>
        <Pressable onPress={() => Linking.openURL(HELP_URL)} accessibilityRole="link">
          <Text style={styles.helpLink}>How to find your calendar URL →</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="https://recollect.a.ssl.fastly.net/api/places/..."
          value={url}
          onChangeText={setUrl}
          testID="input-calendar-url"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          multiline
        />
        {error ? <Text style={styles.error} testID="url-error">{error}</Text> : null}
        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          testID="url-submit"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{loading ? 'Loading…' : 'Show my schedule'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  backRow: { paddingVertical: spacing.xs },
  backLink: { color: colors.primary, fontSize: 15 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  body: { fontSize: 15, color: colors.textSecondary, lineHeight: 24 },
  helpLink: { color: colors.primary, fontSize: 14 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.md, fontSize: 14, backgroundColor: colors.card,
    minHeight: 80, textAlignVertical: 'top',
  },
  error: { color: colors.error, fontSize: 14 },
  button: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
