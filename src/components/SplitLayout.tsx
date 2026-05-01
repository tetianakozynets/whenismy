import React from 'react'
import { View, StyleSheet } from 'react-native'
import { colors } from '../constants/theme'

interface Props {
  form: React.ReactNode
  panel: React.ReactNode
}

export function SplitLayout({ form, panel }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.formColumn}>{form}</View>
      <View style={styles.divider} />
      <View style={styles.panelColumn}>{panel}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  formColumn: {
    width: 320,
    backgroundColor: colors.background,
  },
  divider: {
    width: 1,
    backgroundColor: colors.border,
  },
  panelColumn: {
    flex: 1,
    backgroundColor: colors.background,
  },
})
