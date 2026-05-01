import React, { useState } from 'react'
import {
  View, Text, SafeAreaView, StyleSheet, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { AddressForm } from '../src/components/AddressForm'
import { AddressMatchPicker } from '../src/components/AddressMatchPicker'
import { SplitLayout } from '../src/components/SplitLayout'
import { SchedulePanel } from '../src/components/SchedulePanel'
import { lookupSchedule, isError } from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'
import { useSplitLayout } from '../src/lib/use-split-layout'
import { PlaceMatch, LookupResponse } from '../src/lib/types'
import { colors, spacing } from '../src/constants/theme'

export default function HomeScreen() {
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null)
  const [result, setResult] = useState<LookupResponse | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const isSplit = useSplitLayout()

  async function handleLookup(street: string, city: string, state: string) {
    setLoading(true)
    try {
      const res = await lookupSchedule(street, city, state)
      if (isError(res)) {
        if (res.notFound) {
          router.push('/address-not-found')
        } else {
          Alert.alert('Error', res.error)
        }
        return
      }
      if (res.multiple && res.multiple.length >= 1) {
        scheduleStore.set(res)
        setMatches(res.multiple)
        return
      }
      if (isSplit) {
        setResult(res)
      } else {
        scheduleStore.set(res)
        router.push('/schedule')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleMatchSelect(_match: PlaceMatch) {
    setMatches(null)
    if (isSplit) {
      const stored = scheduleStore.get()
      if (stored) setResult(stored)
    } else {
      router.push('/schedule')
    }
  }

  function handleReset() {
    setResult(null)
    setResetKey(k => k + 1)
  }

  const formContent = (
    <>
      <Text style={styles.title}>whenIsMy</Text>
      <Text style={styles.subtitle}>
        Find your garbage and recycling pickup days
      </Text>
      <AddressForm key={resetKey} onSubmit={handleLookup} loading={loading} />
    </>
  )

  if (isSplit) {
    return (
      <>
        <SplitLayout
          form={<View style={styles.formPadding}>{formContent}</View>}
          panel={<SchedulePanel result={result} onReset={handleReset} />}
        />
        {matches && (
          <AddressMatchPicker
            matches={matches}
            onSelect={handleMatchSelect}
            onDismiss={() => setMatches(null)}
          />
        )}
      </>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {formContent}
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
  formPadding: {
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
