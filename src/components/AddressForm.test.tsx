import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { AddressForm } from './AddressForm'

describe('AddressForm', () => {
  it('calls onSubmit with trimmed inputs, NY selected by default', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
    fireEvent.changeText(getByTestId('input-street'), '  123 Main St  ')
    fireEvent.changeText(getByTestId('input-city'), 'Springfield')
    fireEvent.press(getByTestId('submit-button'))
    expect(onSubmit).toHaveBeenCalledWith('123 Main St', 'Springfield', 'NY')
  })

  it('calls onSubmit with NJ when NJ chip is selected', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
    fireEvent.changeText(getByTestId('input-street'), '123 Main St')
    fireEvent.changeText(getByTestId('input-city'), 'Newark')
    fireEvent.press(getByTestId('state-chip-NJ'))
    fireEvent.press(getByTestId('submit-button'))
    expect(onSubmit).toHaveBeenCalledWith('123 Main St', 'Newark', 'NJ')
  })

  it('shows error and does not submit when street is empty', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
    fireEvent.changeText(getByTestId('input-city'), 'Springfield')
    fireEvent.press(getByTestId('submit-button'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(getByTestId('form-error')).toBeTruthy()
  })

  it('disables the submit button when loading', () => {
    const { getByTestId } = render(<AddressForm onSubmit={jest.fn()} loading={true} />)
    const btn = getByTestId('submit-button')
    expect(btn.props.accessibilityState?.disabled).toBe(true)
  })
})
