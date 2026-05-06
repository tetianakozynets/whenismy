import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../constants/theme'

interface Props {
  titleSize?: number
}

export function WimLogo({ titleSize = 48 }: Props) {
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { fontSize: titleSize }]}>WIM</Text>
      <Text style={styles.subtitle}>When Is My</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  title: {
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 2,
    lineHeight: undefined,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginLeft: 6,    // nudge right to sit under the middle of WIM
    marginTop: -4,    // pull up slightly, tightening the gap with WIM
  },
})
