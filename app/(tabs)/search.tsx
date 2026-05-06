import React, { useState } from 'react'
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AddressForm } from '../../src/components/AddressForm'
import { WimLogo } from '../../src/components/WimLogo'
import { AddressMatchPicker } from '../../src/components/AddressMatchPicker'
import { ScheduleContent } from '../../src/components/ScheduleContent'
import { SplitLayout } from '../../src/components/SplitLayout'
import { SchedulePanel } from '../../src/components/SchedulePanel'
import { router } from 'expo-router'
import { lookupSchedule, isError } from '../../src/lib/api'
import { scheduleStore } from '../../src/lib/schedule-store'
import { toTitleCase } from '../../src/lib/formatting'
import { LookupResponse, PlaceMatch } from '../../src/lib/types'
import { colors, spacing, SPLIT_BREAKPOINT } from '../../src/constants/theme'

export default function SearchTab() {
  const { width } = useWindowDimensions()
  const isSplit = width >= SPLIT_BREAKPOINT

  const [result, setResult] = useState<LookupResponse | null>(null)
  const [address, setAddress] = useState<string | undefined>()
  const [notFound, setNotFound] = useState(false)
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  async function handleLookup(street: string, city: string, state: string) {
    setLoading(true)
    setNotFound(false)
    setResult(null)
    const res = await lookupSchedule(street, city, state)
    setLoading(false)
    if (isError(res)) {
      if (res.notFound) setNotFound(true)
      else if (res.notCovered) router.push('/address-not-found')
      return
    }
    if (res.multiple && res.multiple.length >= 1) {
      scheduleStore.set(res, street, city, state)
      setMatches(res.multiple)
      return
    }
    scheduleStore.set(res, street, city, state)
    setResult(res)
    setAddress([toTitleCase(street), toTitleCase(city), state.toUpperCase()].join(', '))
  }

  function handleMatchSelect(_match: PlaceMatch) {
    setMatches(null)
    const stored = scheduleStore.get()
    if (stored) {
      setResult(stored.result)
      setAddress([toTitleCase(stored.street), toTitleCase(stored.city), stored.state.toUpperCase()].join(', '))
    }
  }

  function handleReset() {
    setResult(null)
    setAddress(undefined)
    setNotFound(false)
    setMatches(null)
    setResetKey(k => k + 1)
  }

  const formContent = (
    <>
      <WimLogo titleSize={36} />
      <Text style={styles.subtitle}>Search any address</Text>
      <AddressForm key={resetKey} onSubmit={handleLookup} loading={loading} />
      {notFound && (
        <Text style={styles.notFoundText}>
          We couldn't find that address. Please double-check and try again.
        </Text>
      )}
    </>
  )

  if (isSplit) {
    return (
      <>
        <SplitLayout
          form={<View style={styles.formPadding}>{formContent}</View>}
          panel={
            <SchedulePanel
              result={result}
              onReset={handleReset}
              address={address}
              notFound={notFound}
            />
          }
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

  if (result) {
    return (
      <ScheduleContent
        result={result}
        onBack={handleReset}
        address={address}
      />
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
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, justifyContent: 'center' },
  formPadding: { padding: spacing.lg, gap: spacing.md },
  title: { fontSize: 32, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center' },
  notFoundText: {
    color: colors.error, fontSize: 14, textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
})
