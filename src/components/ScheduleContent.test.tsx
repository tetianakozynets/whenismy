import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { ScheduleContent } from './ScheduleContent'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}))

const mockUseAuth = jest.fn()
jest.mock('../lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('../lib/holidays', () => ({
  getUSHolidays: jest.fn().mockResolvedValue(new Map()),
  todayHolidayNote: jest.fn().mockReturnValue(undefined),
}))

jest.mock('../lib/saved-address', () => ({
  saveAddressLocally: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../lib/enable-reminders', () => ({
  enableRemindersForAddress: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('./NextPickupCard', () => ({ NextPickupCard: () => null }))
jest.mock('./ScheduleList', () => ({ ScheduleList: () => null }))
jest.mock('./PickupCalendar', () => ({ PickupCalendar: () => null }))

const place = {
  address_key: '1 main st|mahwah|nj',
  recollect_place_id: 'p1',
  latitude: 40.9,
  longitude: -74.1,
  timezone: 'America/New_York',
  supported_event_types: ['garbage'],
  provider: 'recollect' as const,
}
const events = [{ date: '2026-06-01', event_type: 'garbage' }]
const result = { place, events }

beforeEach(() => {
  jest.clearAllMocks()
  mockUseAuth.mockReturnValue({ user: null, session: null, loading: false })
})

it('shows the Save banner when the address is not saved, with no account required', async () => {
  const { findByText } = render(<ScheduleContent result={result} onBack={jest.fn()} />)
  expect(await findByText('Save as my address')).toBeTruthy()
})

it('hides the Save banner once the address matches savedAddress', async () => {
  const { queryByText, findByText } = render(
    <ScheduleContent
      result={result}
      onBack={jest.fn()}
      savedAddress={{ street: '1 main st', city: 'mahwah', state: 'nj' }}
    />
  )
  await findByText(/Get reminders/i)
  expect(queryByText('Save as my address')).toBeNull()
})

it('shows the "Get reminders" upsell when there is no reminders account', async () => {
  const { findByText } = render(<ScheduleContent result={result} onBack={jest.fn()} />)
  expect(await findByText('Get reminders the night before pickup →')).toBeTruthy()
})

it('hides the "Get reminders" upsell once a reminders account exists', async () => {
  mockUseAuth.mockReturnValue({ user: { id: 'u1' }, session: {}, loading: false })
  const { queryByText, findByText } = render(<ScheduleContent result={result} onBack={jest.fn()} />)
  await findByText('Save as my address')
  expect(queryByText(/Get reminders/i)).toBeNull()
})

it('tapping "Get reminders" saves locally, enables reminders, and navigates to /notifications', async () => {
  const { saveAddressLocally } = require('../lib/saved-address')
  const { enableRemindersForAddress } = require('../lib/enable-reminders')
  const { router } = require('expo-router')
  const { findByText } = render(<ScheduleContent result={result} onBack={jest.fn()} />)
  const upsell = await findByText('Get reminders the night before pickup →')
  fireEvent.press(upsell)
  await waitFor(() => {
    expect(saveAddressLocally).toHaveBeenCalledWith({
      street: '1 main st', city: 'mahwah', state: 'nj', place, events,
    })
    expect(enableRemindersForAddress).toHaveBeenCalledWith('1 main st', 'mahwah', 'nj', place, events)
    expect(router.push).toHaveBeenCalledWith('/notifications')
  })
})
