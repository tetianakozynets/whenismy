import { renderHook } from '@testing-library/react-native'

// Import RN and set up spy before importing the hook
const RN = require('react-native')
const spy = jest.spyOn(RN, 'useWindowDimensions')
const { useSplitLayout } = require('./use-split-layout')

afterEach(() => {
  jest.clearAllMocks()
})

it('returns true when width is exactly 768', () => {
  spy.mockReturnValue({ width: 768, height: 900, scale: 1, fontScale: 1 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(true)
})

it('returns true when width is greater than 768', () => {
  spy.mockReturnValue({ width: 1440, height: 900, scale: 1, fontScale: 1 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(true)
})

it('returns false when width is 767', () => {
  spy.mockReturnValue({ width: 767, height: 900, scale: 1, fontScale: 1 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(false)
})

it('returns false when width is 375 (iPhone)', () => {
  spy.mockReturnValue({ width: 375, height: 812, scale: 1, fontScale: 1 })
  const { result } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(false)
})

it('updates when width crosses the breakpoint', () => {
  spy.mockReturnValue({ width: 400, height: 900, scale: 1, fontScale: 1 })
  const { result, rerender } = renderHook(() => useSplitLayout())
  expect(result.current).toBe(false)
  spy.mockReturnValue({ width: 900, height: 900, scale: 1, fontScale: 1 })
  rerender({})
  expect(result.current).toBe(true)
})
