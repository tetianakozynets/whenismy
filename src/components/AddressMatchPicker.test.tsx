import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { AddressMatchPicker } from './AddressMatchPicker'
import { PlaceMatch } from '../lib/types'

const matches: PlaceMatch[] = [
  { id: 'p1', name: '123 Main St', locality: 'Springfield', lat: 40.7, lng: -74.0 },
  { id: 'p2', name: '123 Main St', locality: 'Springfield Township', lat: 40.8, lng: -74.1 },
]

it('renders all match localities', () => {
  const { getByText } = render(
    <AddressMatchPicker matches={matches} onSelect={jest.fn()} onDismiss={jest.fn()} />
  )
  expect(getByText('Springfield')).toBeTruthy()
  expect(getByText('Springfield Township')).toBeTruthy()
})

it('calls onSelect with the tapped match', () => {
  const onSelect = jest.fn()
  const { getByTestId } = render(
    <AddressMatchPicker matches={matches} onSelect={onSelect} onDismiss={jest.fn()} />
  )
  fireEvent.press(getByTestId('match-p2'))
  expect(onSelect).toHaveBeenCalledWith(matches[1])
})
