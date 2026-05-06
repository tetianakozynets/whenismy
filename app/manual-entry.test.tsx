import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import ManualEntryScreen from './manual-entry'
import { useAuth } from '../src/lib/auth-context'
import { saveManualSchedules, generateEventsFromManual } from '../src/lib/manual-schedule'
import { scheduleStore } from '../src/lib/schedule-store'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}))

jest.mock('../src/lib/auth-context', () => ({
  useAuth: jest.fn(),
}))

jest.mock('../src/lib/manual-schedule', () => ({
  saveManualSchedules: jest.fn().mockResolvedValue({}),
  generateEventsFromManual: jest
    .fn()
    .mockReturnValue([{ date: '2026-06-02', event_type: 'garbage' }]),
}))

jest.mock('../src/lib/schedule-store', () => ({
  scheduleStore: { set: jest.fn(), get: jest.fn(), clear: jest.fn() },
}))

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  ;(useAuth as jest.Mock).mockReturnValue({ user: { id: 'u1' } })
})

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderScreen() {
  return render(<ManualEntryScreen />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ManualEntryScreen', () => {
  // 1. Title renders
  it('renders title "Enter your pickup days"', () => {
    const { getByText } = renderScreen()
    expect(getByText('Enter your pickup days')).toBeTruthy()
  })

  // 2. All three cards visible and toggled Off by default
  it('shows Garbage, Recycling and Yard Waste cards all Off by default', () => {
    const { getByText, getAllByText } = renderScreen()
    expect(getByText('Garbage')).toBeTruthy()
    expect(getByText('Recycling')).toBeTruthy()
    expect(getByText('Yard Waste')).toBeTruthy()
    // All three toggle pills should read "Off"
    const offPills = getAllByText('Off')
    expect(offPills).toHaveLength(3)
  })

  // 3. Tapping Garbage header enables it (shows "On", reveals day picker)
  it('enables Garbage card when its header is tapped', () => {
    const { getByText, queryByText, getAllByText } = renderScreen()

    // Before tap: no "On" pill visible
    expect(queryByText('On')).toBeNull()

    fireEvent.press(getByText('Garbage'))

    // After tap: one "On" pill and the day picker label appear
    expect(getByText('On')).toBeTruthy()
    expect(getByText('Pickup day')).toBeTruthy()

    // Day chip "Mon" is visible (default selected day)
    expect(getByText('Mon')).toBeTruthy()
  })

  // 4. Tapping the enabled Garbage header again disables it (shows "Off", hides picker)
  it('disables Garbage card when its header is tapped a second time', () => {
    const { getByText, queryByText } = renderScreen()

    fireEvent.press(getByText('Garbage'))
    // Now it's On — tap again
    fireEvent.press(getByText('Garbage'))

    // Back to Off; day picker label gone
    expect(queryByText('On')).toBeNull()
    expect(queryByText('Pickup day')).toBeNull()
  })

  // 5. Can select a pickup day chip while Garbage is enabled
  it('selects "Wed" chip when tapped while Garbage is enabled', async () => {
    const { getByText } = renderScreen()

    fireEvent.press(getByText('Garbage'))

    // "Wed" chip is visible; tap it
    fireEvent.press(getByText('Wed'))

    // The save path will use wednesday — verify by checking the schedule passed to saveManualSchedules
    fireEvent.press(getByText('Save my schedule'))

    await waitFor(() => {
      expect(saveManualSchedules).toHaveBeenCalledWith(
        'u1',
        expect.arrayContaining([
          expect.objectContaining({ pickup_day: 'wednesday' }),
        ])
      )
    })
  })

  // 6. Can select biweekly frequency chip
  it('selects "Every 2 weeks" chip when tapped while Garbage is enabled', () => {
    const { getByText } = renderScreen()

    fireEvent.press(getByText('Garbage'))
    fireEvent.press(getByText('Every 2 weeks'))

    // Anchor date pressable should now be shown
    expect(getByText('Tap to set anchor date')).toBeTruthy()
  })

  // 7. Biweekly: anchor date pressable shown; tapping it sets a YYYY-MM-DD date string
  it('sets a YYYY-MM-DD anchor date when the anchor pressable is tapped', () => {
    const { getByText, queryByText } = renderScreen()

    fireEvent.press(getByText('Garbage'))
    fireEvent.press(getByText('Every 2 weeks'))

    // Placeholder text is present before tap
    expect(getByText('Tap to set anchor date')).toBeTruthy()

    fireEvent.press(getByText('Tap to set anchor date'))

    // After tap the placeholder is gone and today's date (YYYY-MM-DD) appears
    expect(queryByText('Tap to set anchor date')).toBeNull()

    const today = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const expectedDate = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    expect(queryByText(expectedDate)).toBeTruthy()
  })

  // 8. Save with nothing enabled: saveManualSchedules NOT called
  it('does not call saveManualSchedules when no event types are enabled', async () => {
    const { getByText } = renderScreen()

    fireEvent.press(getByText('Save my schedule'))

    // Give any microtasks a chance to flush
    await waitFor(() => {
      expect(saveManualSchedules).not.toHaveBeenCalled()
    })
  })

  // 9. Save with garbage enabled (weekly, Monday): correct call + router.replace
  it('calls saveManualSchedules with correct input and navigates when garbage is enabled', async () => {
    const { getByText } = renderScreen()

    fireEvent.press(getByText('Garbage'))
    // Default day is monday, default frequency is weekly
    fireEvent.press(getByText('Save my schedule'))

    await waitFor(() => {
      expect(saveManualSchedules).toHaveBeenCalledWith('u1', [
        {
          event_type: 'garbage',
          pickup_day: 'monday',
          frequency: 'weekly',
          anchor_date: null,
        },
      ])
    })

    const { router } = require('expo-router')
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/schedule')
  })

  // 10. Save when user is null: router.push('/sign-in'), saveManualSchedules NOT called
  it('redirects to /sign-in and skips save when user is null', async () => {
    ;(useAuth as jest.Mock).mockReturnValue({ user: null })

    const { getByText } = renderScreen()
    fireEvent.press(getByText('Garbage'))
    fireEvent.press(getByText('Save my schedule'))

    await waitFor(() => {
      const { router } = require('expo-router')
      expect(router.push).toHaveBeenCalledWith('/sign-in')
    })
    expect(saveManualSchedules).not.toHaveBeenCalled()
  })

  // 11. "← Back" calls router.back()
  it('calls router.back() when the back link is pressed', () => {
    const { getByText } = renderScreen()
    fireEvent.press(getByText('← Back'))
    const { router } = require('expo-router')
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  // 12. Save failure: shows Alert, does not navigate, spinner clears
  it('shows an error alert and clears the spinner when saveManualSchedules throws', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert')
    ;(saveManualSchedules as jest.Mock).mockRejectedValueOnce(new Error('network error'))

    const { getByText, queryByTestId } = renderScreen()
    fireEvent.press(getByText('Garbage'))
    fireEvent.press(getByText('Save my schedule'))

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not save your schedule. Please try again.')
    })
    const { router } = require('expo-router')
    expect(router.replace).not.toHaveBeenCalled()
    // Button should re-enable (saving=false), so "Save my schedule" text is back
    expect(getByText('Save my schedule')).toBeTruthy()
  })
})
