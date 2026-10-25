import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { SaveAddressBanner } from './SaveAddressBanner'

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}))

jest.mock('../lib/saved-address', () => ({
  saveAddressLocally: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../lib/enable-reminders', () => ({
  enableRemindersForAddress: jest.fn().mockResolvedValue(undefined),
}))

const mockPlace = {
  address_key: 'test',
  recollect_place_id: null,
  latitude: null,
  longitude: null,
  timezone: null,
  supported_event_types: ['garbage'],
  provider: null as null,
}

const mockEvents = [{ date: '2026-06-01', event_type: 'garbage' }]

function renderBanner(isSaved: boolean) {
  return render(
    <SaveAddressBanner
      street="1 Main St"
      city="Mahwah"
      state="NJ"
      place={mockPlace}
      events={mockEvents}
      isSaved={isSaved}
    />
  )
}

beforeEach(() => jest.clearAllMocks())

describe('SaveAddressBanner', () => {
  it('renders when isSaved is false', () => {
    const { getByText } = renderBanner(false)
    expect(getByText(/Save as my address/i)).toBeTruthy()
  })

  it('renders nothing when isSaved is true', () => {
    const { queryByText } = renderBanner(true)
    expect(queryByText(/Save as my address/i)).toBeNull()
  })

  it('shows confirmation after tapping Save', async () => {
    const { getByText } = renderBanner(false)
    fireEvent.press(getByText('Save'))
    await waitFor(() => {
      expect(getByText(/Address saved/i)).toBeTruthy()
    })
  })

  it('saves locally with the given street, city, state, place, and events', async () => {
    const { saveAddressLocally } = require('../lib/saved-address')
    const { getByText } = renderBanner(false)
    fireEvent.press(getByText('Save'))
    await waitFor(() => {
      expect(saveAddressLocally).toHaveBeenCalledWith({
        street: '1 Main St', city: 'Mahwah', state: 'NJ',
        place: mockPlace, events: mockEvents,
      })
    })
  })

  it('tapping the saved confirmation turns on reminders and navigates to /notifications', async () => {
    const { enableRemindersForAddress } = require('../lib/enable-reminders')
    const { router } = require('expo-router')
    const { getByText } = renderBanner(false)
    fireEvent.press(getByText('Save'))
    const confirmation = await waitFor(() => getByText(/Address saved/i))
    fireEvent.press(confirmation)
    await waitFor(() => {
      expect(enableRemindersForAddress).toHaveBeenCalledWith(
        '1 Main St', 'Mahwah', 'NJ', mockPlace, mockEvents
      )
      expect(router.push).toHaveBeenCalledWith('/notifications')
    })
  })
})
