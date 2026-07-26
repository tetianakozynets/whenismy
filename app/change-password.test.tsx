import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import ChangePasswordScreen from './change-password'
import * as auth from '../src/lib/auth'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}))

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}))

jest.mock('../src/lib/auth-context', () => ({
  useAuth: jest.fn(() => ({ user: { id: 'u1', email: 'test@example.com' } })),
}))

jest.mock('../src/lib/auth', () => ({
  changePassword: jest.fn(),
}))

beforeEach(() => {
  jest.clearAllMocks()
  jest.useRealTimers()
  const { useAuth } = require('../src/lib/auth-context')
  useAuth.mockReturnValue({ user: { id: 'u1', email: 'test@example.com' } })
})

describe('ChangePasswordScreen', () => {
  it('renders nothing when user is null', () => {
    const { useAuth } = require('../src/lib/auth-context')
    useAuth.mockReturnValue({ user: null })
    const { toJSON } = render(<ChangePasswordScreen />)
    expect(toJSON()).toBeNull()
  })

  it('renders three password inputs and a submit button', () => {
    const { getByTestId } = render(<ChangePasswordScreen />)
    expect(getByTestId('input-current-password')).toBeTruthy()
    expect(getByTestId('input-new-password')).toBeTruthy()
    expect(getByTestId('input-confirm-password')).toBeTruthy()
    expect(getByTestId('submit-button')).toBeTruthy()
  })

  it('shows error when any field is empty', async () => {
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.press(getByTestId('submit-button'))
    expect(await findByTestId('error-message')).toHaveTextContent('Please fill in all fields.')
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it('shows error when new password is less than 8 characters', async () => {
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'currentpass123')
    fireEvent.changeText(getByTestId('input-new-password'), 'short')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'short')
    fireEvent.press(getByTestId('submit-button'))
    expect(await findByTestId('error-message')).toHaveTextContent('Password must be at least 8 characters.')
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it('shows error when passwords do not match', async () => {
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'currentpass123')
    fireEvent.changeText(getByTestId('input-new-password'), 'newpass12345678')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'differentpass123')
    fireEvent.press(getByTestId('submit-button'))
    expect(await findByTestId('error-message')).toHaveTextContent('Passwords do not match.')
    expect(auth.changePassword).not.toHaveBeenCalled()
  })

  it('calls changePassword with correct args on valid submit', async () => {
    ;(auth.changePassword as jest.Mock).mockResolvedValue({ error: null })
    jest.useFakeTimers()
    const { getByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'currentpass123')
    fireEvent.changeText(getByTestId('input-new-password'), 'newpass12345678')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'newpass12345678')
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(auth.changePassword).toHaveBeenCalledWith(
      'test@example.com', 'currentpass123', 'newpass12345678'
    )
  })

  it('shows success message and navigates back after 1.5s', async () => {
    ;(auth.changePassword as jest.Mock).mockResolvedValue({ error: null })
    jest.useFakeTimers()
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'currentpass123')
    fireEvent.changeText(getByTestId('input-new-password'), 'newpass12345678')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'newpass12345678')
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(await findByTestId('success-message')).toHaveTextContent('Password updated')
    act(() => jest.advanceTimersByTime(1500))
    const { router } = require('expo-router')
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('shows error message returned by changePassword', async () => {
    ;(auth.changePassword as jest.Mock).mockResolvedValue({ error: 'Current password is incorrect.' })
    const { getByTestId, findByTestId } = render(<ChangePasswordScreen />)
    fireEvent.changeText(getByTestId('input-current-password'), 'wrongpass')
    fireEvent.changeText(getByTestId('input-new-password'), 'newpass12345678')
    fireEvent.changeText(getByTestId('input-confirm-password'), 'newpass12345678')
    await act(async () => {
      fireEvent.press(getByTestId('submit-button'))
    })
    expect(await findByTestId('error-message')).toHaveTextContent('Current password is incorrect.')
  })

  it('calls router.back() when the back link is pressed', () => {
    const { getByText } = render(<ChangePasswordScreen />)
    fireEvent.press(getByText('← Back'))
    const { router } = require('expo-router')
    expect(router.back).toHaveBeenCalledTimes(1)
  })
})
