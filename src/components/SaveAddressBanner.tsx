import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { PlaceInfo, PickupEvent } from '../lib/types'
import { saveAddress, savePickupEvents } from '../lib/user-api'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  userId: string
  street: string
  city: string
  state: string
  place: PlaceInfo
  events: PickupEvent[]
  isSaved: boolean
}

export function SaveAddressBanner({ userId, street, city, state, place, events, isSaved }: Props) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  if (isSaved) return null

  if (saved) {
    return (
      <Pressable
        style={[styles.banner, styles.bannerSaved]}
        onPress={() => router.push('/notifications')}
        accessibilityRole="button"
      >
        <Text style={styles.savedText}>✓ Address saved — set up reminders →</Text>
      </Pressable>
    )
  }

  async function handleSave() {
    setSaving(true)
    await saveAddress(userId, street, city, state, place)
    await savePickupEvents(userId, events)
    setSaving(false)
    setSaved(true)
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
})
