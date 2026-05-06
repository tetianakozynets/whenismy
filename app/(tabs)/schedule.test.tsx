import React from 'react'
import { ActivityIndicator } from 'react-native'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import ScheduleTab from './schedule'
import * as userApi from '../../src/lib/user-api'
import * as api from '../../src/lib/api'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

// Default: user is signed in. Individual tests may override via
// jest.mock / module re-require or by changing the return value.
let mockUser: { id: string; email: string } | null = { id: 'u1', email: 'test@test.com' }

jest.mock('../../src/lib/auth-context', () => ({
  useAuth: () => ({ user: mockUser, session: {}, loading: false }),
}))

jest.mock('../../src/lib/user-api', () => ({
  getPreferences: jest.fn(),
  getManualPickupEvents: jest.fn(),
}))

jest.mock('../../src/lib/api', () => ({
  lookupSchedule: jest.fn(),
  isError: jest.fn(),
}))

// ScheduleContent is complex — mock it so we can test schedule.tsx in isolation.
jest.mock('../../src/components/ScheduleContent', () => ({
  ScheduleContent: ({ address, showBack, savedAddress }: any) => {
    const { Text, View } = require('react-native')
    return (
      <View>
        <Text testID="schedule-content">{address}</Text>
        {showBack && <Text testID="back-link">back-link</Text>}
        {savedAddress && (
          <Text testID="saved-address">
            {savedAddress.street}|{savedAddress.city}|{savedAddress.state}
          </Text>
        )}
      </View>
    )
  },
}))

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const mockPrefs = {
  user_id: 'u1',
  street: '123 main st',
  city: 'springfield',
  state: 'ny',
  recollect_place_id: 'place-1',
  latitude: 40.7,
  longitude: -74.0,
  timezone: 'America/New_York',
  notification_time: '20:00',
  notifications_garbage: true,
  notifications_recycling: false,
  notifications_yard_waste: false,
  supported_event_types: ['garbage'],
}

const mockResult = {
  place: {
    address_key: '123 main st|springfield|ny',
    recollect_place_id: 'place-1',
    latitude: 40.7,
    longitude: -74.0,
    timezone: 'America/New_York',
    supported_event_types: ['garbage'],
    provider: 'recollect' as const,
  },
  events: [{ date: '2026-05-10', event_type: 'garbage' }],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getPreferencesMock = userApi.getPreferences as jest.Mock
const getManualPickupEventsMock = userApi.getManualPickupEvents as jest.Mock
const lookupScheduleMock = api.lookupSchedule as jest.Mock
const isErrorMock = api.isError as jest.Mock

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  isErrorMock.mockReturnValue(false)
  getManualPickupEventsMock.mockResolvedValue([])
  mockUser = { id: 'u1', email: 'test@test.com' }
})

// 1. Returns null when user is null
it('renders nothing when user is not authenticated', () => {
  mockUser = null
  // getPreferences should never be called when user is null
  getPreferencesMock.mockResolvedValue(null)

  const { toJSON } = render(<ScheduleTab />)
  expect(toJSON()).toBeNull()
})

// 2. Shows ActivityIndicator while prefs are loading
it('shows ActivityIndicator immediately after mount while data is loading', async () => {
  // Never resolves during this test — keeps prefs in null (loading) state
  getPreferencesMock.mockReturnValue(new Promise(() => {}))

  const { UNSAFE_getByType } = render(<ScheduleTab />)

  // ActivityIndicator is the only indicator element rendered in the loading state
  expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
})

// 3. Shows "No address saved yet" when getPreferences returns null
it('shows no-address state when getPreferences returns null', async () => {
  getPreferencesMock.mockResolvedValue(null)

  const { getByText } = render(<ScheduleTab />)

  await waitFor(() => {
    expect(getByText('No address saved yet')).toBeTruthy()
  })
  expect(getByText('Go to Search →')).toBeTruthy()
})

// 4. Pressing "Go to Search →" navigates to /(tabs)/search
it('navigates to /(tabs)/search when "Go to Search →" is pressed', async () => {
  getPreferencesMock.mockResolvedValue(null)

  const { getByText } = render(<ScheduleTab />)

  await waitFor(() => {
    expect(getByText('Go to Search →')).toBeTruthy()
  })

  fireEvent.press(getByText('Go to Search →'))

  const { router } = require('expo-router')
  expect(router.push).toHaveBeenCalledWith('/(tabs)/search')
})

// 5. Shows "Couldn't load schedule" when lookupSchedule returns an error
it('shows error state when lookupSchedule returns an error', async () => {
  getPreferencesMock.mockResolvedValue(mockPrefs)
  lookupScheduleMock.mockResolvedValue({ error: 'Service unavailable' })
  isErrorMock.mockReturnValue(true)

  const { getByText } = render(<ScheduleTab />)

  await waitFor(() => {
    expect(getByText("Couldn't load schedule")).toBeTruthy()
  })
  expect(getByText('Service unavailable')).toBeTruthy()
})

// 6. Pressing "Try again" re-triggers load()
it('re-triggers load when "Try again" is pressed', async () => {
  getPreferencesMock.mockResolvedValue(mockPrefs)
  lookupScheduleMock.mockResolvedValue({ error: 'Service unavailable' })
  isErrorMock.mockReturnValue(true)

  const { getByText } = render(<ScheduleTab />)

  await waitFor(() => {
    expect(getByText('Try again')).toBeTruthy()
  })

  // Reset mocks to a success path so the second call renders ScheduleContent
  getPreferencesMock.mockResolvedValue(mockPrefs)
  lookupScheduleMock.mockResolvedValue(mockResult)
  isErrorMock.mockReturnValue(false)

  await act(async () => {
    fireEvent.press(getByText('Try again'))
  })

  // load() calls getPreferences and lookupSchedule — each should now be called twice
  expect(getPreferencesMock).toHaveBeenCalledTimes(2)
  expect(lookupScheduleMock).toHaveBeenCalledTimes(2)
})

// 7. Renders ScheduleContent when prefs + result load successfully
it('renders ScheduleContent when prefs and result load successfully', async () => {
  getPreferencesMock.mockResolvedValue(mockPrefs)
  lookupScheduleMock.mockResolvedValue(mockResult)
  isErrorMock.mockReturnValue(false)

  const { getByTestId } = render(<ScheduleTab />)

  await waitFor(() => {
    expect(getByTestId('schedule-content')).toBeTruthy()
  })
})

// 8. ScheduleContent receives showBack={false} — back link NOT present
it('does not render back link (showBack is false)', async () => {
  getPreferencesMock.mockResolvedValue(mockPrefs)
  lookupScheduleMock.mockResolvedValue(mockResult)
  isErrorMock.mockReturnValue(false)

  const { queryByTestId } = render(<ScheduleTab />)

  await waitFor(() => {
    expect(queryByTestId('schedule-content')).toBeTruthy()
  })

  expect(queryByTestId('back-link')).toBeNull()
})

// 9b. Falls back to manual pickup events when no prefs but manual events exist
it('shows ScheduleContent with manual events when no address saved but manual events exist', async () => {
  getPreferencesMock.mockResolvedValue(null)
  getManualPickupEventsMock.mockResolvedValue([
    { date: '2026-06-02', event_type: 'garbage' },
    { date: '2026-06-09', event_type: 'garbage' },
  ])

  const { getByTestId, queryByText } = render(<ScheduleTab />)

  await waitFor(() => {
    expect(getByTestId('schedule-content')).toBeTruthy()
  })
  expect(queryByText('No address saved yet')).toBeNull()
})

// 9. ScheduleContent receives savedAddress matching prefs street/city/state
it('passes savedAddress with correct street, city, state to ScheduleContent', async () => {
  getPreferencesMock.mockResolvedValue(mockPrefs)
  lookupScheduleMock.mockResolvedValue(mockResult)
  isErrorMock.mockReturnValue(false)

  const { getByTestId } = render(<ScheduleTab />)

  await waitFor(() => {
    expect(getByTestId('saved-address')).toBeTruthy()
  })

  // React renders JSX template expressions as an array of children nodes;
  // flatten them into a single string before comparing.
  const children = getByTestId('saved-address').props.children
  const text = Array.isArray(children) ? children.join('') : children
  expect(text).toBe(`${mockPrefs.street}|${mockPrefs.city}|${mockPrefs.state}`)
})
