import { useState, useEffect } from 'react'
import * as RN from 'react-native'
import { SPLIT_BREAKPOINT } from '../constants/theme'

export function useSplitLayout(): boolean {
  const { width } = RN.useWindowDimensions()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return mounted && width >= SPLIT_BREAKPOINT
}
