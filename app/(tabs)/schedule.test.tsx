import React from 'react'
import { ActivityIndicator } from 'react-native'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import ScheduleTab from './schedule'
import { getSavedAddress, isStale, saveAddressLocally } from '../../src/lib/saved-address'
import * as api from '../../src/lib/api'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('../../src/lib/saved-address', () => ({
  getSavedAddress: jest.fn(),
  isStale: jest.fn(),
  saveAddressLocally: jest.fn().mockResolvedValue(undefined),
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

const basePlace = {
  address_key: '123 main st|springfield|ny',
  recollect_place_id: 'place-1',
  latitude: 40.7,
  longitude: -74.0,
  timezone: 'America/New_York',
  supported_event_types: ['garbage'],
  provider: 'recollect' as const,
}

const baseEvents = [{ date: '2026-05-10', event_type: 'garbage' }]

const freshSaved = {
  street: '123 main st', city: 'springfield', state: 'ny',
  place: basePlace, events: baseEvents, savedAt: '2026-05-01T00:00:00.000Z',
}

const getSavedAddressMock = getSavedAddress as jest.Mock
const isStaleMock = isStale as jest.Mock
const lookupScheduleMock = api.lookupSchedule as jest.Mock
const isErrorMock = api.isError as jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  isErrorMock.mockReturnValue(false)
  isStaleMock.mockReturnValue(false)
})

// 1. Shows ActivityIndicator while the saved address is loading
it('shows ActivityIndicator immediately after mount while data is loading', () => {
  getSavedAddressMock.mockReturnValue(new Promise(() => {})) // never resolves
  const { UNSAFE_getByType } = render(<ScheduleTab />)
  expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
})

// 2. Shows "No address saved yet" when getSavedAddress returns null
it('shows no-address state when getSavedAddress returns null', async () => {
  getSavedAddressMock.mockResolvedValue(null)
  const { getByText } = render(<ScheduleTab />)
  await waitFor(() => expect(getByText('No address saved yet')).toBeTruthy())
  expect(getByText('Go to Search →')).toBeTruthy()
})

// 3. Pressing "Go to Search →" navigates to /(tabs)/search
it('navigates to /(tabs)/search when "Go to Search →" is pressed', async () => {
  getSavedAddressMock.mockResolvedValue(null)
  const { getByText } = render(<ScheduleTab />)
  await waitFor(() => expect(getByText('Go to Search →')).toBeTruthy())
  fireEvent.press(getByText('Go to Search →'))
  const { router } = require('expo-router')
  expect(router.push).toHaveBeenCalledWith('/(tabs)/search')
})

// 4. Renders directly from the local record without calling lookupSchedule when fresh
it('renders ScheduleContent from the local record without calling lookupSchedule when fresh', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  isStaleMock.mockReturnValue(false)
  const { getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('schedule-content')).toBeTruthy())
  expect(lookupScheduleMock).not.toHaveBeenCalled()
})

// 5. Refreshes from lookupSchedule and re-saves locally when the saved record is stale
it('calls lookupSchedule and re-saves locally when the saved record is stale', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  isStaleMock.mockReturnValue(true)
  lookupScheduleMock.mockResolvedValue({ place: basePlace, events: baseEvents })
  const { getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('schedule-content')).toBeTruthy())
  expect(lookupScheduleMock).toHaveBeenCalledWith('123 main st', 'springfield', 'ny')
  expect(saveAddressLocally).toHaveBeenCalledWith({
    street: '123 main st', city: 'springfield', state: 'ny',
    place: basePlace, events: baseEvents,
  })
})

// 6. Shows "Couldn't load schedule" when the stale refresh errors
it('shows error state when the stale refresh returns an error', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  isStaleMock.mockReturnValue(true)
  lookupScheduleMock.mockResolvedValue({ error: 'Service unavailable' })
  isErrorMock.mockReturnValue(true)
  const { getByText } = render(<ScheduleTab />)
  await waitFor(() => expect(getByText("Couldn't load schedule")).toBeTruthy())
  expect(getByText('Service unavailable')).toBeTruthy()
})

// 7. Pressing "Try again" re-triggers load()
it('re-triggers load when "Try again" is pressed', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  isStaleMock.mockReturnValue(true)
  lookupScheduleMock.mockResolvedValue({ error: 'Service unavailable' })
  isErrorMock.mockReturnValue(true)

  const { getByText } = render(<ScheduleTab />)
  await waitFor(() => expect(getByText('Try again')).toBeTruthy())

  lookupScheduleMock.mockResolvedValue({ place: basePlace, events: baseEvents })
  isErrorMock.mockReturnValue(false)

  await act(async () => {
    fireEvent.press(getByText('Try again'))
  })

  expect(getSavedAddressMock).toHaveBeenCalledTimes(2)
  expect(lookupScheduleMock).toHaveBeenCalledTimes(2)
})

// 8. ScheduleContent receives showBack={false}
it('does not render back link (showBack is false)', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  const { queryByTestId, getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('schedule-content')).toBeTruthy())
  expect(queryByTestId('back-link')).toBeNull()
})

// 9. Manually-entered schedules render directly, with no address label, no refresh
it('renders manual schedule events directly, with no address label', async () => {
  getSavedAddressMock.mockResolvedValue({
    street: 'manual', city: '', state: '',
    place: { ...basePlace, address_key: 'manual||', provider: null },
    events: [{ date: '2026-06-02', event_type: 'garbage' }],
    manualSchedules: [{ event_type: 'garbage' as const, pickup_day: 'monday' as const, frequency: 'weekly' as const, anchor_date: null }],
    savedAt: '2026-06-01T00:00:00.000Z',
  })
  const { getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('schedule-content')).toBeTruthy())
  expect(getByTestId('schedule-content').props.children).toBeUndefined()
  expect(lookupScheduleMock).not.toHaveBeenCalled()
})

// 10. ScheduleContent receives savedAddress matching the saved record's street/city/state
it('passes savedAddress with correct street, city, state to ScheduleContent', async () => {
  getSavedAddressMock.mockResolvedValue(freshSaved)
  const { getByTestId } = render(<ScheduleTab />)
  await waitFor(() => expect(getByTestId('saved-address')).toBeTruthy())
  const children = getByTestId('saved-address').props.children
  const text = Array.isArray(children) ? children.join('') : children
  expect(text).toBe('123 main st|springfield|ny')
})
