import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert, ActivityIndicator } from 'react-native'
import AccountTab from './account'
import * as userApi from '../../src/lib/user-api'
import * as auth from '../../src/lib/auth'
import { UserPreferences } from '../../src/lib/types'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}))

const mockUseAuth = jest.fn()
jest.mock('../../src/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('../../src/lib/auth', () => ({
  signOut: jest.fn(),
}))

jest.mock('../../src/lib/user-api', () => ({
  getPreferences: jest.fn(),
  deleteAccount: jest.fn(),
}))

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
}

const basePrefs: UserPreferences = {
  user_id: 'user-123',
  street: '123 Main St',
  city: 'Springfield',
  state: 'NY',
  recollect_place_id: null,
  latitude: null,
  longitude: null,
  timezone: null,
  notification_time: '20:00',
  notifications_garbage: false,
  notifications_recycling: false,
  notifications_yard_waste: false,
  supported_event_types: [],
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let alertSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

afterEach(() => {
  alertSpy.mockRestore()
})

// ---------------------------------------------------------------------------
// Helper: render with a logged-in user and wait for prefs to settle
// ---------------------------------------------------------------------------

async function renderLoaded(prefs: UserPreferences | null = null) {
  mockUseAuth.mockReturnValue({ user: mockUser, session: null, loading: false })
  ;(userApi.getPreferences as jest.Mock).mockResolvedValue(prefs)

  const utils = render(<AccountTab />)
  // Wait for the ActivityIndicator to disappear once the prefs promise settles
  await waitFor(() => {
    expect(utils.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
  })
  return utils
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AccountTab', () => {
  // 1. Renders nothing when user is null
  it('renders nothing when user is null (not signed in)', () => {
    mockUseAuth.mockReturnValue({ user: null, session: null, loading: false })
    const { toJSON } = render(<AccountTab />)
    expect(toJSON()).toBeNull()
  })

  // 2. Shows loading spinner while prefs are loading
  it('shows activity indicator while preferences are loading', async () => {
    mockUseAuth.mockReturnValue({ user: mockUser, session: null, loading: false })

    // Never resolves during this test so loading stays true
    ;(userApi.getPreferences as jest.Mock).mockReturnValue(new Promise(() => {}))

    const { UNSAFE_getByType } = render(<AccountTab />)
    // ActivityIndicator does not expose a progressbar role in the test renderer;
    // querying by component type is the reliable alternative.
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })

  // 3. Renders user email after prefs load
  it('renders the signed-in user email after prefs load', async () => {
    const { getByText } = await renderLoaded()
    expect(getByText('test@example.com')).toBeTruthy()
  })

  // 4. remindersSummary shows 'Off' when all notifications are false
  it('shows "Off" for reminders when all notifications are disabled', async () => {
    const prefs = { ...basePrefs, notifications_garbage: false, notifications_recycling: false, notifications_yard_waste: false }
    const { getByText } = await renderLoaded(prefs)
    expect(getByText('Off')).toBeTruthy()
  })

  // 5. remindersSummary shows correct active types
  it('shows active notification types joined with " · "', async () => {
    const prefs = { ...basePrefs, notifications_garbage: true, notifications_recycling: true, notifications_yard_waste: false }
    const { getByText } = await renderLoaded(prefs)
    expect(getByText('Garbage · Recycling')).toBeTruthy()
  })

  it('shows all three active notification types', async () => {
    const prefs = { ...basePrefs, notifications_garbage: true, notifications_recycling: true, notifications_yard_waste: true }
    const { getByText } = await renderLoaded(prefs)
    expect(getByText('Garbage · Recycling · Yard Waste')).toBeTruthy()
  })

  // 6. addressSummary shows 'None saved' when no prefs
  it('shows "None saved" for address when prefs is null', async () => {
    const { getByText } = await renderLoaded(null)
    expect(getByText('None saved')).toBeTruthy()
  })

  // 7. addressSummary shows 'Street, City, STATE' when prefs exist
  it('shows "Street, City, STATE" when prefs contain an address', async () => {
    const { getByText } = await renderLoaded(basePrefs)
    expect(getByText('123 Main St, Springfield, NY')).toBeTruthy()
  })

  // 8. Pressing "Reminders settings" tile navigates to /notifications
  it('navigates to /notifications when Reminders tile is pressed', async () => {
    const { getByLabelText } = await renderLoaded(basePrefs)
    fireEvent.press(getByLabelText('Reminders settings'))
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/notifications')
  })

  // 9. Pressing "Change saved address" tile navigates to /(tabs)/search
  it('navigates to /(tabs)/search when Address tile is pressed', async () => {
    const { getByLabelText } = await renderLoaded(basePrefs)
    fireEvent.press(getByLabelText('Change saved address'))
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/(tabs)/search')
  })

  // 10. Pressing "Sign out" calls signOut and navigates to /
  it('calls signOut and navigates to / when Sign out is pressed', async () => {
    ;(auth.signOut as jest.Mock).mockResolvedValue(undefined)
    const { getByText } = await renderLoaded(basePrefs)

    await act(async () => {
      fireEvent.press(getByText('Sign out'))
    })

    const { router } = require('expo-router')
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  // 11. Sign-out failure shows Alert with error message
  it('shows an error Alert when signOut throws', async () => {
    ;(auth.signOut as jest.Mock).mockRejectedValue(new Error('network error'))
    const { getByText } = await renderLoaded(basePrefs)

    await act(async () => {
      fireEvent.press(getByText('Sign out'))
    })

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not sign out. Please try again.')
  })

  // 12. Pressing "Delete account" shows confirmation Alert
  it('shows confirmation Alert when Delete account is pressed', async () => {
    const { getByText } = await renderLoaded(basePrefs)
    fireEvent.press(getByText('Delete account'))

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete account',
      'This will permanently delete your account and all saved data. This cannot be undone.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ])
    )
  })

  // 13. Confirming delete calls deleteAccount() and navigates to /
  it('calls deleteAccount and navigates to / when delete is confirmed', async () => {
    ;(userApi.deleteAccount as jest.Mock).mockResolvedValue(undefined)
    ;(auth.signOut as jest.Mock).mockResolvedValue(undefined)

    const { getByText } = await renderLoaded(basePrefs)
    fireEvent.press(getByText('Delete account'))

    // Grab the onPress from the destructive "Delete" button passed to Alert
    const alertCall = alertSpy.mock.calls[0]
    const buttons: Array<{ text: string; style?: string; onPress?: () => Promise<void> }> = alertCall[2]
    const deleteButton = buttons.find(b => b.text === 'Delete')
    expect(deleteButton).toBeDefined()

    await act(async () => {
      await deleteButton!.onPress!()
    })

    const { router } = require('expo-router')
    expect(userApi.deleteAccount).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  // Bonus: deleteAccount failure shows error Alert
  it('shows an error Alert when deleteAccount throws', async () => {
    ;(userApi.deleteAccount as jest.Mock).mockRejectedValue(new Error('rpc error'))
    ;(auth.signOut as jest.Mock).mockResolvedValue(undefined)

    const { getByText } = await renderLoaded(basePrefs)
    fireEvent.press(getByText('Delete account'))

    const alertCall = alertSpy.mock.calls[0]
    const buttons: Array<{ text: string; style?: string; onPress?: () => Promise<void> }> = alertCall[2]
    const deleteButton = buttons.find(b => b.text === 'Delete')

    // Clear the first call so we can assert on the error one
    alertSpy.mockClear()

    await act(async () => {
      await deleteButton!.onPress!()
    })

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not delete account. Please try again.')
  })
})
