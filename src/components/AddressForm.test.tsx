import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { AddressForm } from './AddressForm'

describe('AddressForm', () => {
  it('calls onSubmit with trimmed inputs and uppercased state', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
    fireEvent.changeText(getByTestId('input-street'), '  123 Main St  ')
    fireEvent.changeText(getByTestId('input-city'), 'Springfield')
    fireEvent.changeText(getByTestId('input-state'), 'ny')
    fireEvent.press(getByTestId('submit-button'))
    expect(onSubmit).toHaveBeenCalledWith('123 Main St', 'Springfield', 'NY')
  })

  it('shows error and does not submit when street is empty', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
    fireEvent.changeText(getByTestId('input-city'), 'Springfield')
    fireEvent.changeText(getByTestId('input-state'), 'NY')
    fireEvent.press(getByTestId('submit-button'))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(getByTestId('form-error')).toBeTruthy()
  })

  it('shows error for a state value that is not 2 letters', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
    fireEvent.changeText(getByTestId('input-street'), '123 Main St')
    fireEvent.changeText(getByTestId('input-city'), 'Springfield')
    fireEvent.changeText(getByTestId('input-state'), 'New York')
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
