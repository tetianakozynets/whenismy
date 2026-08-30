import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { colors } from '../constants/theme'

interface Props {
  titleSize?: number
  align?: 'left' | 'center'
}

export function WimLogo({ titleSize = 48, align = 'left' }: Props) {
  return (
    <View style={[styles.container, align === 'center' && styles.containerCentered]}>
      <Image
        source={require('../../assets/icon.png')}
        style={{ width: titleSize, height: titleSize, borderRadius: titleSize * 0.22 }}
      />
      <Text style={styles.subtitle}>
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
