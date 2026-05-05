import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import HomeScreen from './index'
import * as api from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}))

jest.mock('../src/lib/auth-context', () => ({
  useAuth: () => ({ user: null, session: null, loading: false }),
}))

jest.mock('../src/lib/user-api', () => ({
  saveAddress: jest.fn().mockResolvedValue({}),
  savePickupEvents: jest.fn().mockResolvedValue({}),
  getPreferences: jest.fn().mockResolvedValue(null),
  updateNotificationPreferences: jest.fn().mockResolvedValue({}),
  deleteAccount: jest.fn().mockResolvedValue({}),
}))

jest.mock('../src/lib/use-split-layout', () => ({
  useSplitLayout: jest.fn().mockReturnValue(false),
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
  const { useSplitLayout } = require('../src/lib/use-split-layout')
  useSplitLayout.mockReturnValue(false)
})

it('navigates to /schedule and saves result to store on success (narrow)', async () => {
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
  const { getByTestId } = render(<HomeScreen />)
  fireEvent.changeText(getByTestId('input-street'), '123 Main St')
  fireEvent.changeText(getByTestId('input-city'), 'Springfield')
  // NY is pre-selected by default
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
  const { getByTestId, findByText } = render(<HomeScreen />)
  fireEvent.changeText(getByTestId('input-street'), '99 Unknown')
  fireEvent.changeText(getByTestId('input-city'), 'Nowhere')
  fireEvent.press(getByTestId('submit-button'))

  await findByText(/couldn't find that address/i)
  const { router } = require('expo-router')
  expect(router.push).not.toHaveBeenCalledWith('/address-not-found')
})

it('does not navigate on success when in split layout (wide screen)', async () => {
  const { useSplitLayout } = require('../src/lib/use-split-layout')
  useSplitLayout.mockReturnValue(true)
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
  const { getByTestId } = render(<HomeScreen />)
  fireEvent.changeText(getByTestId('input-street'), '123 Main St')
  fireEvent.changeText(getByTestId('input-city'), 'Springfield')
  // NY is pre-selected; press NJ chip to test state chip interaction
  fireEvent.press(getByTestId('state-chip-NJ'))
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    expect(api.lookupSchedule).toHaveBeenCalled()
  })
  const { router } = require('expo-router')
  expect(router.push).not.toHaveBeenCalledWith('/schedule')
  // On wide screens setResult is called directly; scheduleStore is NOT populated
  expect(scheduleStore.getResult()).toBeNull()
})
