import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import HomeScreen from './index'
import * as api from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'
import { getSavedAddress } from '../src/lib/saved-address'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
  Redirect: ({ href }: { href: string }) => {
    const { Text } = require('react-native')
    return <Text testID="redirect">{href}</Text>
  },
}))

jest.mock('../src/lib/saved-address', () => ({
  getSavedAddress: jest.fn(),
}))

jest.mock('../src/lib/use-split-layout', () => ({
  useSplitLayout: jest.fn().mockReturnValue(false),
}))

jest.mock('../src/lib/auth-context', () => ({
  useAuth: () => ({ user: null, session: null, loading: false }),
}))

jest.mock('../src/lib/enable-reminders', () => ({
  enableRemindersForAddress: jest.fn().mockResolvedValue(undefined),
}))

jest.spyOn(api, 'lookupSchedule')

const mockResult = {
  place: {
    address_key: '123 main|springfield|ny',
    recollect_place_id: 'place-1',
    latitude: 40.7,
    longitude: -74.0,
    timezone: 'America/New_York',
    supported_event_types: ['garbage'],
    provider: 'recollect' as const,
  },
  events: [{ date: '2026-04-28', event_type: 'garbage' }],
}

beforeEach(() => {
  jest.clearAllMocks()
  scheduleStore.clear()
  ;(getSavedAddress as jest.Mock).mockResolvedValue(null)
  const { useSplitLayout } = require('../src/lib/use-split-layout')
  useSplitLayout.mockReturnValue(false)
})

it('redirects to the schedule tab when an address is already saved locally', async () => {
  ;(getSavedAddress as jest.Mock).mockResolvedValue({
    street: '1 Main St', city: 'Mahwah', state: 'NJ',
    place: mockResult.place, events: mockResult.events, savedAt: new Date().toISOString(),
  })
  const { findByTestId } = render(<HomeScreen />)
  expect(await findByTestId('redirect')).toHaveTextContent('/(tabs)/schedule')
})

it('navigates to /schedule and saves result to store on success (narrow)', async () => {
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
  const { findByTestId, getByTestId } = render(<HomeScreen />)
  await findByTestId('input-street')
  fireEvent.changeText(getByTestId('input-street'), '123 Main St')
  fireEvent.changeText(getByTestId('input-city'), 'Springfield')
  // NJ is pre-selected by default
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/schedule')
  })
  expect(scheduleStore.getResult()).toEqual(mockResult)
})

it('shows not-found error inline when address is not found', async () => {
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce({
    error: 'Address not found',
    notFound: true,
  })
  const { findByTestId, getByTestId, findByText } = render(<HomeScreen />)
  await findByTestId('input-street')
  fireEvent.changeText(getByTestId('input-street'), '99 Unknown')
  fireEvent.changeText(getByTestId('input-city'), 'Nowhere')
  fireEvent.press(getByTestId('submit-button'))

  await findByText(/please enter a valid address/i)
  const { router } = require('expo-router')
  expect(router.push).not.toHaveBeenCalledWith('/address-not-found')
})

it('does not navigate on success when in split layout (wide screen)', async () => {
  const { useSplitLayout } = require('../src/lib/use-split-layout')
  useSplitLayout.mockReturnValue(true)
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
  const { findByTestId, getByTestId } = render(<HomeScreen />)
  await findByTestId('input-street')
  fireEvent.changeText(getByTestId('input-street'), '123 Main St')
  fireEvent.changeText(getByTestId('input-city'), 'Springfield')
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    expect(api.lookupSchedule).toHaveBeenCalled()
  })
  const { router } = require('expo-router')
  expect(router.push).not.toHaveBeenCalledWith('/schedule')
  // On wide screens setResult is called directly; scheduleStore is NOT populated
  expect(scheduleStore.getResult()).toBeNull()
})
