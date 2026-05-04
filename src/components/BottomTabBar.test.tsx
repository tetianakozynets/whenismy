import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { BottomTabBar } from './BottomTabBar'

const makeProps = (activeIndex = 0) => ({
  state: {
    index: activeIndex,
    routes: [{ name: 'schedule' }, { name: 'search' }, { name: 'account' }],
  },
  navigation: { navigate: jest.fn() },
})

describe('BottomTabBar', () => {
  it('renders three tabs', () => {
    const { getByText } = render(<BottomTabBar {...makeProps()} />)
    expect(getByText('Schedule')).toBeTruthy()
    expect(getByText('Search')).toBeTruthy()
    expect(getByText('Account')).toBeTruthy()
  })

  it('calls navigation.navigate when a tab is pressed', () => {
    const props = makeProps(0)
    const { getByLabelText } = render(<BottomTabBar {...props} />)
    fireEvent.press(getByLabelText('Search'))
    expect(props.navigation.navigate).toHaveBeenCalledWith('search')
  })

  it('marks the active tab with selected accessibility state', () => {
    const { getByLabelText } = render(<BottomTabBar {...makeProps(1)} />)
    expect(getByLabelText('Search').props.accessibilityState).toEqual({ selected: true })
    expect(getByLabelText('Schedule').props.accessibilityState).toEqual({ selected: false })
  })
})
