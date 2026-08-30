import React, { useState } from 'react'
import {
  View, Text, SafeAreaView, StyleSheet, Alert, Pressable, Platform,
} from 'react-native'
import { router, Redirect } from 'expo-router'
import { AddressForm } from '../src/components/AddressForm'
import { WimLogo } from '../src/components/WimLogo'
import { AddressMatchPicker } from '../src/components/AddressMatchPicker'
import { SplitLayout } from '../src/components/SplitLayout'
import { SchedulePanel } from '../src/components/SchedulePanel'
import { lookupSchedule, isError } from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'
import { useSplitLayout } from '../src/lib/use-split-layout'
import { PlaceMatch, LookupResponse } from '../src/lib/types'
import { toTitleCase } from '../src/lib/formatting'
import { colors, spacing } from '../src/constants/theme'
import { useAuth } from '../src/lib/auth-context'

export default function HomeScreen() {
  const [loading, setLoading] = useState(false)
  const [matches, setMatches] = useState<PlaceMatch[] | null>(null)
  const [result, setResult] = useState<LookupResponse | null>(null)
  const [address, setAddress] = useState<string | undefined>(undefined)
  const [notFound, setNotFound] = useState(false)
  const [serviceUnavailable, setServiceUnavailable] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  const isSplit = useSplitLayout()
  const { user } = useAuth()
  if (user) return <Redirect href="/(tabs)/schedule" />

  async function handleLookup(street: string, city: string, state: string) {
    setLoading(true)
    setNotFound(false)
    setServiceUnavailable(false)
    try {
      const res = await lookupSchedule(street, city, state)
      if (isError(res)) {
        if (res.notFound) {
          setNotFound(true)
          setResult(null)
        } else if (res.notCovered) {
          router.push('/address-not-found')
        } else if (res.serviceUnavailable) {
          setServiceUnavailable(true)
          setResult(null)
        } else {
          Alert.alert('Error', res.error)
        }
        return
      }
      if (res.multiple && res.multiple.length >= 1) {
        scheduleStore.set(res, street, city, state)
        setMatches(res.multiple)
        return
      }
      if (isSplit) {
        setResult(res)
        setAddress([toTitleCase(street), toTitleCase(city), state.toUpperCase()].filter(Boolean).join(', '))
      } else {
        scheduleStore.set(res, street, city, state)
        router.push('/schedule')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleMatchSelect(_match: PlaceMatch) {
    setMatches(null)
    if (isSplit) {
      // Plan 2 limitation: the lookup-schedule Edge Function returns events for places[0]
      // regardless of which match the user selects. A proper re-fetch by place ID
      // requires extending the Edge Function to accept a placeId param (Plan 3+).
      const stored = scheduleStore.get()
      if (stored) {
        setResult(stored.result)
        setAddress([toTitleCase(stored.street), toTitleCase(stored.city), stored.state.toUpperCase()].filter(Boolean).join(', '))
      }
    } else {
      router.push('/schedule')
    }
  }

  function handleReset() {
    setResult(null)
    setAddress(undefined)
    setNotFound(false)
    setServiceUnavailable(false)
    setMatches(null)
    setResetKey(k => k + 1)
  }

  const formContent = (
    <>
      <WimLogo titleSize={40} align="center" />
      <Text style={styles.subtitle}>
        Find your garbage and recycling pickup days
      </Text>
      <AddressForm key={resetKey} onSubmit={handleLookup} loading={loading} />
      {notFound && !isSplit && (
        <View style={styles.notFoundBox}>
          <Text style={styles.notFoundText}>
            Please enter a valid address.
          </Text>
        </View>
      )}
      {serviceUnavailable && !isSplit && (
        <View style={styles.notFoundBox}>
          <Text style={styles.notFoundText}>
            Schedule data is temporarily unavailable for this address. Please try again later.
          </Text>
        </View>
      )}
    </>
  )

  if (isSplit) {
    return (
      <>
        <SplitLayout
          form={<View style={styles.formPadding}>{formContent}</View>}
          panel={<SchedulePanel result={result} onReset={handleReset} address={address} notFound={notFound} serviceUnavailable={serviceUnavailable} />}
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
        {Platform.OS !== 'web' && (
          <Pressable
            style={styles.signInRow}
            onPress={() => router.push({ pathname: '/sign-in', params: { mode: 'signin' } })}
            accessibilityRole="button"
            testID="btn-sign-in"
          >
            <Text style={styles.signInText}>
              Have an account? <Text style={styles.signInLink}>Sign in →</Text>
            </Text>
          </Pressable>
        )}
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
  notFoundBox: {
    backgroundColor: '#2a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    borderRadius: 6,
    padding: spacing.md,
  },
  notFoundText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  signInRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  signInText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  signInLink: {
    color: colors.primary,
    fontWeight: '600',
  },
})
