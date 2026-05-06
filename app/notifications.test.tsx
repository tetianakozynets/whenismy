import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import NotificationsScreen from './notifications'
import { getPreferences, updateNotificationPreferences } from '../src/lib/user-api'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}))

// Default: authenticated user. Individual tests that need user=null override this.
jest.mock('../src/lib/auth-context', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'u1', email: 'test@test.com' } })),
}))

jest.mock('../src/lib/user-api', () => ({
  getPreferences: jest.fn(),
  updateNotificationPreferences: jest.fn().mockResolvedValue({}),
}))

// Mock NotificationToggle to render a simple, testable element that mirrors
// the real component's toggle behaviour without requiring a native Switch.
jest.mock('../src/components/NotificationToggle', () => ({
  NotificationToggle: ({ label, value, onValueChange }: any) => {
    const { Text, Pressable } = require('react-native')
    return (
      <Pressable testID={`toggle-${label.toLowerCase()}`} onPress={() => onValueChange(!value)}>
        <Text>{label}: {value ? 'on' : 'off'}</Text>
      </Pressable>
    )
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid UserPreferences object, overridable per test. */
function makePrefs(overrides: Record<string, unknown> = {}) {
  return {
    notifications_garbage: true,
    notifications_recycling: true,
    notifications_yard_waste: false,
    notification_time: '20:00',
    supported_event_types: [],
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  // Re-apply default authenticated user after clearAllMocks resets useAuth.
  const { useAuth } = require('../src/lib/auth-context')
  useAuth.mockReturnValue({ user: { id: 'u1', email: 'test@test.com' } })
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationsScreen', () => {
  // 1. Returns null when user is null
  it('renders nothing when there is no authenticated user', () => {
    const { useAuth } = require('../src/lib/auth-context')
    useAuth.mockReturnValue({ user: null })

    const { toJSON } = render(<NotificationsScreen />)
    expect(toJSON()).toBeNull()
  })

  // 2. Shows ActivityIndicator while preferences are loading
  it('shows an ActivityIndicator while preferences are being fetched', () => {
    // Never resolves during this test — keeps component in loading state.
    ;(getPreferences as jest.Mock).mockReturnValue(new Promise(() => {}))

    const { getByTestId, queryByTestId } = render(<NotificationsScreen />)

    expect(getByTestId('activity-indicator')).toBeTruthy()
    expect(queryByTestId('toggle-garbage')).toBeNull()
  })

  // 3. After prefs load with supportedTypes=[]: shows both Garbage and Recycling toggles
  it('shows Garbage and Recycling toggles when supportedTypes is empty', async () => {
    ;(getPreferences as jest.Mock).mockResolvedValue(makePrefs({ supported_event_types: [] }))

    const { findByTestId } = render(<NotificationsScreen />)

    expect(await findByTestId('toggle-garbage')).toBeTruthy()
    expect(await findByTestId('toggle-recycling')).toBeTruthy()
  })

  // 4. After prefs load with supportedTypes=['garbage']: shows Garbage but not Recycling
  it('shows Garbage toggle but not Recycling when supportedTypes is ["garbage"]', async () => {
    ;(getPreferences as jest.Mock).mockResolvedValue(
      makePrefs({ supported_event_types: ['garbage'] })
    )

    const { findByTestId, queryByTestId } = render(<NotificationsScreen />)

    expect(await findByTestId('toggle-garbage')).toBeTruthy()
    // Wait for loading to finish before asserting absence.
    await waitFor(() => expect(queryByTestId('toggle-recycling')).toBeNull())
  })

  // 5. Yard-waste toggle only shown when supportedTypes includes 'yard_waste'
  it('hides the Yard Waste toggle when yard_waste is not in supportedTypes', async () => {
    ;(getPreferences as jest.Mock).mockResolvedValue(
      makePrefs({ supported_event_types: [] })
    )

    const { queryByTestId, findByTestId } = render(<NotificationsScreen />)

    // Wait for loading to complete.
    await findByTestId('toggle-garbage')
    expect(queryByTestId('toggle-yard waste')).toBeNull()
  })

  it('shows the Yard Waste toggle when supportedTypes includes yard_waste', async () => {
    ;(getPreferences as jest.Mock).mockResolvedValue(
      makePrefs({ supported_event_types: ['garbage', 'yard_waste'] })
    )

    const { findByTestId } = render(<NotificationsScreen />)

    expect(await findByTestId('toggle-yard waste')).toBeTruthy()
  })

  // 6. Toggle values reflect what was loaded from preferences
  it('initialises toggle values from fetched preferences', async () => {
    ;(getPreferences as jest.Mock).mockResolvedValue(
      makePrefs({
        notifications_garbage: false,
        notifications_recycling: true,
        supported_event_types: [],
      })
    )

    const { findByText } = render(<NotificationsScreen />)

    expect(await findByText('Garbage: off')).toBeTruthy()
    expect(await findByText('Recycling: on')).toBeTruthy()
  })

  // 7. Time selection is initialised from prefs.notification_time
  it('marks the time chip from prefs.notification_time as selected', async () => {
    ;(getPreferences as jest.Mock).mockResolvedValue(
      makePrefs({ notification_time: '19:00' })
    )

    const { findByText } = render(<NotificationsScreen />)

    // The save button appears once loading is done; then check the time label.
    await findByText('Save')
    // 7:00 PM corresponds to 19:00.
    expect(await findByText('7:00 PM')).toBeTruthy()
  })

  // 8. Pressing a time chip changes the selected time
  it('changes the selected time when a different chip is pressed', async () => {
    ;(getPreferences as jest.Mock).mockResolvedValue(
      makePrefs({ notification_time: '20:00' })
    )

    const { findByText, getByText } = render(<NotificationsScreen />)

    // Wait for the UI to finish loading.
    await findByText('Save')

    // Press the 10:00 PM chip (corresponds to 22:00).
    await act(async () => {
      fireEvent.press(getByText('10:00 PM'))
    })

    // 22:00 chip should now be selected; verify by pressing Save and
    // checking the argument passed to updateNotificationPreferences.
    await act(async () => {
      fireEvent.press(getByText('Save'))
    })

    await waitFor(() => {
      expect(updateNotificationPreferences).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ notification_time: '22:00' })
      )
    })
  })

  // 9. Pressing Save calls updateNotificationPreferences with correct args and then router.back()
  it('calls updateNotificationPreferences with correct args and navigates back on Save', async () => {
    ;(getPreferences as jest.Mock).mockResolvedValue(
      makePrefs({
        notifications_garbage: true,
        notifications_recycling: false,
        notifications_yard_waste: false,
        notification_time: '21:00',
        supported_event_types: [],
      })
    )
    ;(updateNotificationPreferences as jest.Mock).mockResolvedValue({})

    const { findByText, getByText } = render(<NotificationsScreen />)

    await findByText('Save')

    await act(async () => {
      fireEvent.press(getByText('Save'))
    })

    await waitFor(() => {
      expect(updateNotificationPreferences).toHaveBeenCalledWith('u1', {
        notifications_garbage: true,
        notifications_recycling: false,
        notifications_yard_waste: false,
        notification_time: '21:00',
      })
    })

    const { router } = require('expo-router')
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  // 10. "← Back" calls router.back()
  it('calls router.back() when the back link is pressed', async () => {
    ;(getPreferences as jest.Mock).mockResolvedValue(makePrefs())

    const { findByText, getByText } = render(<NotificationsScreen />)

    // Wait for the screen to finish loading so the back link is visible.
    await findByText('Reminders')

    fireEvent.press(getByText('← Back'))

    const { router } = require('expo-router')
    expect(router.back).toHaveBeenCalledTimes(1)
  })
})
