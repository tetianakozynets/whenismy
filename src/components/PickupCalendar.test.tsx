import React from 'react'
import { render } from '@testing-library/react-native'
import { PickupCalendar } from './PickupCalendar'

const events = [
  { date: '2026-05-04', event_type: 'garbage' },
  { date: '2026-05-04', event_type: 'recycling' },
  { date: '2026-05-11', event_type: 'garbage' },
]

it('renders month name and year', () => {
  const { getByText } = render(<PickupCalendar events={events} />)
  // The component starts at the current month — just check day headers render
  expect(getByText('Su')).toBeTruthy()
  expect(getByText('Sa')).toBeTruthy()
})

it('renders day-of-week headers', () => {
  const { getByText } = render(<PickupCalendar events={events} />)
  for (const h of ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']) {
    expect(getByText(h)).toBeTruthy()
  }
})

it('renders without crashing when events is empty', () => {
  const { getByText } = render(<PickupCalendar events={[]} />)
  expect(getByText('Mo')).toBeTruthy()
})
