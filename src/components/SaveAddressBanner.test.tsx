import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import { SaveAddressBanner } from './SaveAddressBanner'

jest.mock('../lib/user-api', () => ({
  saveAddress: jest.fn().mockResolvedValue({}),
  savePickupEvents: jest.fn().mockResolvedValue({}),
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

describe('SaveAddressBanner', () => {
  it('renders when isSaved is false', () => {
    const { getByText } = render(
      <SaveAddressBanner
        userId="u1"
        street="1 Main St"
        city="Mahwah"
        state="NJ"
        place={mockPlace}
        events={mockEvents}
        isSaved={false}
      />
    )
    expect(getByText(/Save as my address/i)).toBeTruthy()
  })

  it('renders nothing when isSaved is true', () => {
    const { queryByText } = render(
      <SaveAddressBanner
        userId="u1"
        street="1 Main St"
        city="Mahwah"
        state="NJ"
        place={mockPlace}
        events={mockEvents}
        isSaved={true}
      />
    )
    expect(queryByText(/Save as my address/i)).toBeNull()
  })

  it('shows confirmation after tapping Save', async () => {
    const { getByText } = render(
      <SaveAddressBanner
        userId="u1"
        street="1 Main St"
        city="Mahwah"
        state="NJ"
        place={mockPlace}
        events={mockEvents}
        isSaved={false}
      />
    )
    fireEvent.press(getByText('Save'))
    await waitFor(() => {
      expect(getByText(/Address saved/i)).toBeTruthy()
    })
  })
})
