import React from 'react'
import {
  View, Text, Pressable, StyleSheet, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { colors, spacing, radius } from '../src/constants/theme'

export default function AddressNotFoundScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Address not found</Text>
        <Text style={styles.body}>
          We couldn't find pickup schedule data for your address. Your municipality
          may not be covered yet.
        </Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Try a different address</Text>
        </Pressable>
        <Text style={styles.note}>
          Sign in to request coverage for your area.
        </Text>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, color: colors.textSecondary, lineHeight: 24 },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
})
