import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import HomeScreen from './index'
import * as api from '../src/lib/api'
import { scheduleStore } from '../src/lib/schedule-store'

// Mock expo-router navigation
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
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
  },
  events: [{ date: '2026-04-28', event_type: 'garbage' }],
}

beforeEach(() => {
  jest.clearAllMocks()
  scheduleStore.clear()
})

it('navigates to /schedule and saves result to store on success', async () => {
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
  const { getByTestId } = render(<HomeScreen />)
  fireEvent.changeText(getByTestId('input-street'), '123 Main St')
  fireEvent.changeText(getByTestId('input-city'), 'Springfield')
  fireEvent.changeText(getByTestId('input-state'), 'NY')
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/schedule')
  })
  expect(scheduleStore.get()).toEqual(mockResult)
})

it('navigates to /address-not-found when address is not found', async () => {
  ;(api.lookupSchedule as jest.Mock).mockResolvedValueOnce({
    error: 'Address not found',
    notFound: true,
  })
  const { getByTestId } = render(<HomeScreen />)
  fireEvent.changeText(getByTestId('input-street'), '99 Unknown')
  fireEvent.changeText(getByTestId('input-city'), 'Nowhere')
  fireEvent.changeText(getByTestId('input-state'), 'XX')
  fireEvent.press(getByTestId('submit-button'))

  await waitFor(() => {
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/address-not-found')
  })
})
