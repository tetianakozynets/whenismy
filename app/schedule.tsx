import React, { useEffect } from 'react'
import { SafeAreaView, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { scheduleStore } from '../src/lib/schedule-store'
import { ScheduleContent } from '../src/components/ScheduleContent'
import { useSplitLayout } from '../src/lib/use-split-layout'
import { colors } from '../src/constants/theme'

export default function ScheduleScreen() {
  const result = scheduleStore.get()
  const isSplit = useSplitLayout()

  useEffect(() => {
    if (isSplit || !result) {
      router.replace('/')
    }
  }, [isSplit, result])

  useEffect(() => {
    return () => scheduleStore.clear()
  }, [])

  if (isSplit || !result) return null

  return (
    <SafeAreaView style={styles.safe}>
      <ScheduleContent result={result} onBack={() => router.back()} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
})
