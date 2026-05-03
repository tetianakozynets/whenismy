import React from 'react'
import { View, Text, Switch, StyleSheet } from 'react-native'
import { colors, spacing } from '../constants/theme'

interface Props {
  label: string
  icon: string
  value: boolean
  onValueChange: (v: boolean) => void
  disabled?: boolean
}

export function NotificationToggle({ label, icon, value, onValueChange, disabled }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  icon: { fontSize: 20 },
  label: { flex: 1, fontSize: 16, color: colors.text },
})
