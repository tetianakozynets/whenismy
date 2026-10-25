import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { router } from 'expo-router'
import { PlaceInfo, PickupEvent } from '../lib/types'
import { saveAddressLocally } from '../lib/saved-address'
import { enableRemindersForAddress } from '../lib/enable-reminders'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  street: string
  city: string
  state: string
  place: PlaceInfo
  events: PickupEvent[]
  isSaved: boolean
}

export function SaveAddressBanner({ street, city, state, place, events, isSaved }: Props) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (isSaved) return null

  async function handleSetUpReminders() {
    setEnabling(true)
    try {
      await enableRemindersForAddress(street, city, state, place, events)
      router.push('/notifications')
    } catch {
      Alert.alert('Error', 'Could not turn on reminders. Please try again.')
    } finally {
      setEnabling(false)
    }
  }

  if (saved) {
    return (
      <Pressable
        style={[styles.banner, styles.bannerSaved]}
        onPress={handleSetUpReminders}
        disabled={enabling}
        accessibilityRole="button"
      >
        <Text style={styles.savedText}>
          {enabling ? 'Turning on reminders…' : '✓ Address saved — set up reminders →'}
        </Text>
      </Pressable>
    )
  }

  async function handleSave() {
    setSaving(true)
    setSaveError(null)
    try {
      await saveAddressLocally({ street, city, state, place, events })
      setSaved(true)
    } catch {
      setSaveError('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={styles.banner}>
      <View style={styles.bannerLeft}>
        <Text style={styles.bannerIcon}>📍</Text>
        <Text style={styles.bannerText}>Save as my address</Text>
      </View>
      <Pressable
        style={styles.saveButton}
        onPress={handleSave}
        disabled={saving}
        accessibilityRole="button"
      >
        {saving
          ? <ActivityIndicator color="#fff" size="small" />
          : <Text style={styles.saveButtonText}>Save</Text>
        }
      </Pressable>
      {saveError && <Text style={styles.errorText}>{saveError}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  bannerSaved: {
    borderColor: '#10B981',
    justifyContent: 'center',
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  bannerIcon: { fontSize: 18 },
  bannerText: { fontSize: 14, color: colors.text, fontWeight: '500' },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 56,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  savedText: { fontSize: 14, color: '#10B981', fontWeight: '500' },
  errorText: { fontSize: 12, color: colors.error, marginTop: 4 },
})
