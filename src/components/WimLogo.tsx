import React, { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '../constants/theme'

interface Props {
  titleSize?: number
  align?: 'left' | 'center'
}

export function WimLogo({ titleSize = 48, align = 'left' }: Props) {
  const [wimWidth, setWimWidth] = useState(0)

  return (
    <View style={[styles.container, align === 'center' && styles.containerCentered]}>
      <Text
        style={[styles.title, { fontSize: titleSize }]}
        onLayout={e => setWimWidth(e.nativeEvent.layout.width)}
      >
        WIM
      </Text>
      <Text style={[styles.subtitle, wimWidth > 0 && { width: wimWidth, marginLeft: 0 }]}>
        When Is My
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
  containerCentered: {
    alignSelf: 'center',
  },
  title: {
    fontWeight: '900',
    color: colors.primary,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginTop: -4,
    textAlign: 'center',
  },
})
