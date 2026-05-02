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
  expect(getAllByText(/Garbage|Recycling/).length).toBe(3)
})

it('skips the first date group when skipFirst is true', () => {
  const { getAllByText } = render(<ScheduleList events={events} skipFirst />)
  expect(getAllByText(/Garbage|Recycling/).length).toBe(2)
})

it('renders nothing when events array is empty', () => {
  const { queryAllByText } = render(<ScheduleList events={[]} />)
  expect(queryAllByText(/Garbage|Recycling/).length).toBe(0)
})

it('groups multiple pickups on the same day into one row', () => {
  const sameDay: PickupEvent[] = [
    { date: '2026-04-28', event_type: 'garbage' },
    { date: '2026-04-28', event_type: 'recycling' },
    { date: '2026-05-05', event_type: 'garbage' },
  ]
  const { getAllByText } = render(<ScheduleList events={sameDay} />)
  // 3 badges but only 2 date rows
  expect(getAllByText(/Garbage|Recycling/).length).toBe(3)
  expect(getAllByText(/April 28/).length).toBe(1)
})

it('skipFirst skips the entire first date group including all its events', () => {
  const sameDay: PickupEvent[] = [
    { date: '2026-04-28', event_type: 'garbage' },
    { date: '2026-04-28', event_type: 'recycling' },
    { date: '2026-05-05', event_type: 'garbage' },
  ]
  const { getAllByText, queryByText } = render(<ScheduleList events={sameDay} skipFirst />)
  expect(getAllByText(/Garbage/).length).toBe(1)
  expect(queryByText(/Recycling/)).toBeNull()
})
