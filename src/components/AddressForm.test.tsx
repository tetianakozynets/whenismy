import React from 'react'
import { render, fireEvent } from '@testing-library/react-native'
import { AddressForm } from './AddressForm'

describe('AddressForm', () => {
  it('calls onSubmit with trimmed street and auto-filled "New York City" when NYC is selected', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
    fireEvent.press(getByTestId('state-chip-NY'))
    fireEvent.changeText(getByTestId('input-street'), '  123 Main St  ')
    // City is locked to "New York City" when NYC is selected — rendered as a
    // static value, not an editable input
    fireEvent.press(getByTestId('submit-button'))
    expect(onSubmit).toHaveBeenCalledWith('123 Main St', 'New York City', 'NY')
  })

  it('clears city and makes it editable when switching from NYC to NJ', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
    fireEvent.press(getByTestId('state-chip-NY'))
    fireEvent.press(getByTestId('state-chip-NJ'))
    fireEvent.changeText(getByTestId('input-street'), '123 Main St')
    fireEvent.changeText(getByTestId('input-city'), 'Newark')
    fireEvent.press(getByTestId('submit-button'))
    expect(onSubmit).toHaveBeenCalledWith('123 Main St', 'Newark', 'NJ')
  })

  it('calls onSubmit with NJ by default', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
    fireEvent.changeText(getByTestId('input-street'), '123 Main St')
    fireEvent.changeText(getByTestId('input-city'), 'Newark')
    fireEvent.press(getByTestId('submit-button'))
    expect(onSubmit).toHaveBeenCalledWith('123 Main St', 'Newark', 'NJ')
  })

  it('shows error and does not submit when street is empty', () => {
    const onSubmit = jest.fn()
    const { getByTestId } = render(<AddressForm onSubmit={onSubmit} loading={false} />)
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
