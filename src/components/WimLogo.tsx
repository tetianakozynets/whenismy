import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { colors } from '../constants/theme'

interface Props {
  titleSize?: number
  align?: 'left' | 'center'
}

// Natural aspect ratio (width / height) of assets/wim-wordmark.png
const WORDMARK_ASPECT_RATIO = 936 / 291

export function WimLogo({ titleSize = 48, align = 'left' }: Props) {
  const wordmarkWidth = titleSize * WORDMARK_ASPECT_RATIO

  return (
    <View style={[styles.container, align === 'center' && styles.containerCentered]}>
      <Image
        source={require('../../assets/wim-wordmark.png')}
        resizeMode="contain"
        style={{ width: wordmarkWidth, height: titleSize }}
      />
      <Text style={[styles.subtitle, { width: wordmarkWidth }]}>
        When Is My
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  containerCentered: {
    alignSelf: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginTop: 4,
    textAlign: 'center',
  },
})
