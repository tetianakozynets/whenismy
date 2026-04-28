import React, { useState } from 'react'
import {
  View, Text, SafeAreaView, StyleSheet, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { AddressForm } from '../src/components/AddressForm'
import { AddressMatchPicker } from '../src/components/AddressMatchPicker'
import { lookupSchedule, isError } from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'
import { PlaceMatch } from '../src/lib/types'
import { colors, spacing } from '../src/constants/theme'

export default function HomeScreen() {
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null)

  async function handleLookup(street: string, city: string, state: string) {
    setLoading(true)
    try {
      const result = await lookupSchedule(street, city, state)
      if (isError(result)) {
        if (result.notFound) {
          router.push('/address-not-found')
        } else {
          Alert.alert('Error', result.error)
        }
        return
      }
      if (result.multiple && result.multiple.length >= 1) {
        scheduleStore.set(result)
        setMatches(result.multiple)
        return
      }
      scheduleStore.set(result)
      router.push('/schedule')
    } finally {
      setLoading(false)
    }
  }

  function handleMatchSelect(_match: PlaceMatch) {
    // Plan 2 limitation: the lookup-schedule Edge Function returns events for places[0]
    // regardless of which match the user selects here. A proper re-fetch by place ID
    // requires extending the Edge Function to accept a placeId param (Plan 3+).
    setMatches(null)
    router.push('/schedule')
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>whenIsMy</Text>
        <Text style={styles.subtitle}>
          Find your garbage and recycling pickup days
        </Text>
        <AddressForm onSubmit={handleLookup} loading={loading} />
      </View>
      {matches && (
        <AddressMatchPicker
          matches={matches}
          onSelect={handleMatchSelect}
          onDismiss={() => setMatches(null)}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
  },
})
