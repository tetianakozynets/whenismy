import React, { useRef, useState } from 'react'
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native'
import { colors, spacing, radius } from '../constants/theme'

interface Props {
  value: string     // "HH:MM" 24-hour, e.g. "19:30"
  onChange: (v: string) => void
}

function parse(v: string): { h: number; m: number } {
  const [hh, mm] = v.split(':').map(Number)
  return { h: isNaN(hh) ? 20 : hh, m: isNaN(mm) ? 0 : mm }
}

function toHHMM(h: number, m: number) {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function TimePicker({ value, onChange }: Props) {
  const { h, m } = parse(value)
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const isAM = h < 12

  const [hourText, setHourText] = useState(String(hour12))
  const [minText, setMinText] = useState(String(m).padStart(2, '0'))
  const [ap, setAp] = useState<'AM' | 'PM'>(isAM ? 'AM' : 'PM')
  const minRef = useRef<TextInput>(null)

  function commit(hText: string, mText: string, ampm: 'AM' | 'PM') {
    const hNum = parseInt(hText, 10)
    const mNum = parseInt(mText, 10)
    if (isNaN(hNum) || isNaN(mNum)) return
    const h12 = Math.max(1, Math.min(12, hNum))
    const mFinal = Math.max(0, Math.min(59, mNum))
    const h24 = ampm === 'AM'
      ? (h12 === 12 ? 0 : h12)
      : (h12 === 12 ? 12 : h12 + 12)
    onChange(toHHMM(h24, mFinal))
  }

  function handleHourBlur() {
    const num = parseInt(hourText, 10)
    const clamped = isNaN(num) ? 12 : Math.max(1, Math.min(12, num))
    setHourText(String(clamped))
    commit(String(clamped), minText, ap)
  }

  function handleMinBlur() {
    const num = parseInt(minText, 10)
    const clamped = isNaN(num) ? 0 : Math.max(0, Math.min(59, num))
    const padded = String(clamped).padStart(2, '0')
    setMinText(padded)
    commit(hourText, String(clamped), ap)
  }

  function toggleAp() {
    const next: 'AM' | 'PM' = ap === 'AM' ? 'PM' : 'AM'
    setAp(next)
    commit(hourText, minText, next)
  }

  return (
    <View style={styles.row}>
      <TextInput
        style={styles.field}
        value={hourText}
        onChangeText={setHourText}
        onBlur={handleHourBlur}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        returnKeyType="next"
        onSubmitEditing={() => minRef.current?.focus()}
        testID="time-hour"
        accessibilityLabel="Hour"
      />
      <Text style={styles.colon}>:</Text>
      <TextInput
        ref={minRef}
        style={styles.field}
        value={minText}
        onChangeText={setMinText}
        onBlur={handleMinBlur}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        returnKeyType="done"
        testID="time-minute"
        accessibilityLabel="Minute"
      />
      <Pressable
        style={[styles.ampmBtn, ap === 'PM' && styles.ampmBtnPM]}
        onPress={toggleAp}
        accessibilityRole="button"
        testID="time-ampm"
      >
        <Text style={styles.ampmText}>{ap}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  field: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    minWidth: 72,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  colon: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  ampmBtn: {
    marginLeft: spacing.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minWidth: 56,
    alignItems: 'center',
  },
  ampmBtnPM: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  ampmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
})
