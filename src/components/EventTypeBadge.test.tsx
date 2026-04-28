import React from 'react'
import { render } from '@testing-library/react-native'
import { EventTypeBadge } from './EventTypeBadge'

it('renders Garbage label', () => {
  const { getByText } = render(<EventTypeBadge eventType="garbage" />)
  expect(getByText('Garbage')).toBeTruthy()
})

it('renders Recycling label', () => {
  const { getByText } = render(<EventTypeBadge eventType="recycling" />)
  expect(getByText('Recycling')).toBeTruthy()
})

it('renders Yard Waste label', () => {
  const { getByText } = render(<EventTypeBadge eventType="yard_waste" />)
  expect(getByText('Yard Waste')).toBeTruthy()
})

it('renders unknown types with title-cased label', () => {
  const { getByText } = render(<EventTypeBadge eventType="bulk_pickup" />)
  expect(getByText('Bulk Pickup')).toBeTruthy()
})
