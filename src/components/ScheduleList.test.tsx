import React from 'react'
import { render } from '@testing-library/react-native'
import { ScheduleList } from './ScheduleList'
import { PickupEvent } from '../lib/types'

const events: PickupEvent[] = [
  { date: '2026-04-28', event_type: 'garbage' },
  { date: '2026-05-05', event_type: 'recycling' },
  { date: '2026-05-12', event_type: 'garbage' },
]

it('renders all events by default', () => {
  const { getAllByText } = render(<ScheduleList events={events} />)
  // Each row shows the event type label. 2 garbage + 1 recycling = 3 badges.
  expect(getAllByText(/Garbage|Recycling/).length).toBe(3)
})

it('skips the first event when skipFirst is true', () => {
  const { getAllByText } = render(<ScheduleList events={events} skipFirst />)
  expect(getAllByText(/Garbage|Recycling/).length).toBe(2)
})

it('renders nothing when events array is empty', () => {
  const { queryAllByText } = render(<ScheduleList events={[]} />)
  expect(queryAllByText(/Garbage|Recycling/).length).toBe(0)
})
