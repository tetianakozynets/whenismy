import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import SignInScreen from './sign-in'
import * as authLib from '../src/lib/auth'
import { scheduleStore } from '../src/lib/schedule-store'
import { saveAddress, savePickupEvents } from '../src/lib/user-api'
import { registerPushToken } from '../src/lib/push-notifications'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: () => ({}),   // default: no mode param → signup
}))

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}))

jest.mock('../src/lib/auth', () => ({
  signUp: jest.fn(),
  signIn: jest.fn(),
}))

jest.mock('../src/lib/user-api', () => ({
  saveAddress: jest.fn().mockResolvedValue({}),
  savePickupEvents: jest.fn().mockResolvedValue({}),
}))

jest.mock('../src/lib/push-notifications', () => ({
  registerPushToken: jest.fn(),
}))

jest.mock('../src/lib/schedule-store', () => ({
  scheduleStore: { get: jest.fn().mockReturnValue(null) },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderScreen() {
  return render(<SignInScreen />)
}

function fillForm(utils: ReturnType<typeof renderScreen>, email: string, password: string) {
  fireEvent.changeText(utils.getByTestId('input-email'), email)
  fireEvent.changeText(utils.getByTestId('input-password'), password)
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SignInScreen', () => {
  // 1. Renders in signup mode by default
  it('renders in signup mode by default showing "Create your account"', () => {
    const { getByText } = renderScreen()
    expect(getByText('Create your account')).toBeTruthy()
    expect(getByText('Create account')).toBeTruthy()
  })

  // 2. Validation error when fields are empty
  it('shows validation error when email and password are empty', async () => {
    const utils = renderScreen()
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      expect(utils.getByText('Please enter email and password.')).toBeTruthy()
    })
  })

  // 3. Validation error when password is shorter than 8 characters
  it('shows validation error when password is shorter than 8 characters', async () => {
    const utils = renderScreen()
    fillForm(utils, 'user@example.com', 'short')
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      expect(utils.getByText('Password must be at least 8 characters.')).toBeTruthy()
    })
  })

  // 4. Switches to sign-in mode when toggle link is tapped
  it('switches to sign-in mode when "Already have an account?" is tapped', () => {
    const { getAllByText, queryByText } = renderScreen()
    fireEvent.press(getAllByText(/Already have an account\? Sign in/)[0])
    // "Create your account" title is gone
    expect(queryByText('Create your account')).toBeNull()
    // Submit button label changes from "Create account" to something else
    expect(queryByText('Create account')).toBeNull()
    // Toggle link now shows sign-up copy
    expect(queryByText("Don't have an account? Sign up")).toBeTruthy()
  })

  // 5. Calls signUp with email + password on submit (signup mode)
  it('calls signUp with trimmed email and password on submit in signup mode', async () => {
    ;(authLib.signUp as jest.Mock).mockResolvedValueOnce({ data: { session: null, user: null }, error: null })
    const utils = renderScreen()
    fillForm(utils, '  user@example.com  ', 'supersecret1234')
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      expect(authLib.signUp).toHaveBeenCalledWith('user@example.com', 'supersecret1234')
    })
  })

  // 6a. Signup with no session → navigates to /check-email (confirmation required)
  it('navigates to /check-email when signUp returns no session (confirmation required)', async () => {
    ;(authLib.signUp as jest.Mock).mockResolvedValueOnce({ data: { session: null, user: null }, error: null })
    const utils = renderScreen()
    fillForm(utils, 'user@example.com', 'supersecret1234')
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      const { router } = require('expo-router')
      expect(router.replace).toHaveBeenCalledWith({
        pathname: '/check-email',
        params: { email: 'user@example.com' },
      })
    })
  })

  // 6b. Signup with session → signs in immediately (confirmation disabled)
  it('navigates to /(tabs)/schedule when signUp returns a session immediately', async () => {
    ;(authLib.signUp as jest.Mock).mockResolvedValueOnce({
      data: { session: { access_token: 'tok' }, user: { id: 'u1' } },
      error: null,
    })
    const utils = renderScreen()
    fillForm(utils, 'user@example.com', 'supersecret1234')
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      const { router } = require('expo-router')
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/schedule')
    })
  })

  // 7. Calls signIn on submit in sign-in mode
  it('calls signIn with email and password when in sign-in mode', async () => {
    ;(authLib.signIn as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    })
    const utils = renderScreen()
    // Switch to sign-in mode
    fireEvent.press(utils.getByText('Already have an account? Sign in'))
    fillForm(utils, 'user@example.com', 'supersecret1234')
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      expect(authLib.signIn).toHaveBeenCalledWith('user@example.com', 'supersecret1234')
    })
  })

  // 8. Navigates to /(tabs)/schedule after successful sign-in
  it('navigates to /(tabs)/schedule after successful sign-in', async () => {
    ;(authLib.signIn as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-abc' } },
      error: null,
    })
    const utils = renderScreen()
    fireEvent.press(utils.getByText('Already have an account? Sign in'))
    fillForm(utils, 'user@example.com', 'supersecret1234')
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      const { router } = require('expo-router')
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/schedule')
    })
  })

  // 8a. After sign-in with a stored result, saveAddress and savePickupEvents are called
  it('saves stored address and pickup events after successful sign-in', async () => {
    const mockStored = {
      street: '123 Main St',
      city: 'Springfield',
      state: 'NY',
      result: {
        place: {
          address_key: '123 main|springfield|ny',
          recollect_place_id: 'place-1',
          latitude: 40.7,
          longitude: -74.0,
          timezone: 'America/New_York',
          supported_event_types: ['garbage'],
          provider: 'recollect' as const,
        },
        events: [{ date: '2026-05-10', event_type: 'garbage' }],
      },
    }
    ;(scheduleStore.get as jest.Mock).mockReturnValue(mockStored)
    ;(authLib.signIn as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-abc' } },
      error: null,
    })
    const utils = renderScreen()
    fireEvent.press(utils.getByText('Already have an account? Sign in'))
    fillForm(utils, 'user@example.com', 'supersecret1234')
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      expect(saveAddress).toHaveBeenCalledWith(
        'user-abc',
        '123 Main St',
        'Springfield',
        'NY',
        mockStored.result.place
      )
      expect(savePickupEvents).toHaveBeenCalledWith(
        'user-abc',
        mockStored.result.events
      )
    })
  })

  // 8b. registerPushToken is called with userId after sign-in
  it('calls registerPushToken with the signed-in user id', async () => {
    ;(authLib.signIn as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-abc' } },
      error: null,
    })
    const utils = renderScreen()
    fireEvent.press(utils.getByText('Already have an account? Sign in'))
    fillForm(utils, 'user@example.com', 'supersecret1234')
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      expect(registerPushToken).toHaveBeenCalledWith('user-abc')
    })
  })

  // 9. Shows error message on sign-in failure
  it('shows error message when signIn returns an error', async () => {
    ;(authLib.signIn as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    })
    const utils = renderScreen()
    fireEvent.press(utils.getByText('Already have an account? Sign in'))
    fillForm(utils, 'user@example.com', 'supersecret1234')
    fireEvent.press(utils.getByTestId('submit-button'))
    await waitFor(() => {
      expect(utils.getByText('Invalid login credentials')).toBeTruthy()
    })
  })

  // 10. "← Back" calls router.back()
  it('calls router.back() when the back link is pressed', () => {
    const { getByText } = renderScreen()
    fireEvent.press(getByText('← Back'))
    const { router } = require('expo-router')
    expect(router.back).toHaveBeenCalledTimes(1)
  })
})
