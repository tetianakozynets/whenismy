import React from 'react'
import { render, fireEvent, waitFor, act } from '@testing-library/react-native'
import { Alert, ActivityIndicator } from 'react-native'
import AccountTab from './account'
import * as userApi from '../../src/lib/user-api'
import * as auth from '../../src/lib/auth'
import * as savedAddress from '../../src/lib/saved-address'
import * as enableReminders from '../../src/lib/enable-reminders'
import { UserPreferences } from '../../src/lib/types'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
}))

const mockUseAuth = jest.fn()
jest.mock('../../src/lib/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}))

jest.mock('../../src/lib/auth', () => ({
  signOut: jest.fn(),
}))

jest.mock('../../src/lib/user-api', () => ({
  getPreferences: jest.fn(),
  deleteAccount: jest.fn(),
}))

jest.mock('../../src/lib/saved-address', () => ({
  getSavedAddress: jest.fn(),
  clearSavedAddress: jest.fn(),
}))

jest.mock('../../src/lib/enable-reminders', () => ({
  enableRemindersForAddress: jest.fn(),
  enableRemindersForManualSchedule: jest.fn(),
}))

const noAccount = { user: null, session: null, loading: false }
const withAccount = { user: { id: 'user-123' }, session: {}, loading: false }

const savedRecord = {
  street: '123 Main St', city: 'Springfield', state: 'NY',
  place: {
    address_key: '123 main st|springfield|ny', recollect_place_id: 'p1',
    latitude: 40.7, longitude: -74.0, timezone: 'America/New_York',
    supported_event_types: ['garbage'], provider: 'recollect' as const,
  },
  events: [{ date: '2026-06-01', event_type: 'garbage' }],
  savedAt: '2026-06-01T00:00:00.000Z',
}

const manualSavedRecord = {
  ...savedRecord,
  street: 'manual', city: '', state: '',
  manualSchedules: [
    { event_type: 'garbage' as const, pickup_day: 'monday' as const, frequency: 'weekly' as const, anchor_date: null },
  ],
}

const basePrefs: UserPreferences = {
  user_id: 'user-123',
  street: '123 Main St',
  city: 'Springfield',
  state: 'NY',
  recollect_place_id: null,
  latitude: null,
  longitude: null,
  timezone: null,
  notification_time: '20:00',
  notifications_garbage: false,
  notifications_recycling: false,
  notifications_yard_waste: false,
  supported_event_types: [],
}

let alertSpy: jest.SpyInstance

beforeEach(() => {
  jest.clearAllMocks()
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {})
})

afterEach(() => {
  alertSpy.mockRestore()
})

async function renderLoaded(opts: {
  auth?: typeof noAccount | typeof withAccount
  saved?: typeof savedRecord | null
  prefs?: UserPreferences | null
} = {}) {
  mockUseAuth.mockReturnValue(opts.auth ?? noAccount)
  const saved = 'saved' in opts ? opts.saved : savedRecord
  ;(savedAddress.getSavedAddress as jest.Mock).mockResolvedValue(saved)
  ;(userApi.getPreferences as jest.Mock).mockResolvedValue(opts.prefs ?? basePrefs)

  const utils = render(<AccountTab />)
  await waitFor(() => {
    expect(utils.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
  })
  return utils
}

describe('AccountTab', () => {
  it('shows an activity indicator while the saved address is loading', () => {
    mockUseAuth.mockReturnValue(noAccount)
    ;(savedAddress.getSavedAddress as jest.Mock).mockReturnValue(new Promise(() => {}))
    const { UNSAFE_getByType } = render(<AccountTab />)
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy()
  })

  it('shows "None saved" for address when nothing is saved locally', async () => {
    const { getByText } = await renderLoaded({ saved: null })
    expect(getByText('None saved')).toBeTruthy()
  })

  it('shows the formatted address when one is saved locally', async () => {
    const { getByText } = await renderLoaded()
    expect(getByText('123 Main St, Springfield, NY')).toBeTruthy()
  })

  it('shows "Manually entered" for a manual saved address', async () => {
    const { getByText } = await renderLoaded({ saved: manualSavedRecord })
    expect(getByText('Manually entered')).toBeTruthy()
  })

  it('shows "Tap to turn on" for reminders when there is no account', async () => {
    const { getByText } = await renderLoaded({ auth: noAccount })
    expect(getByText('Tap to turn on')).toBeTruthy()
  })

  it('shows "Off" for reminders when an account exists but all notifications are disabled', async () => {
    const { getByText } = await renderLoaded({ auth: withAccount, prefs: basePrefs })
    expect(getByText('Off')).toBeTruthy()
  })

  it('shows active notification types joined with " · " when an account exists', async () => {
    const prefs = { ...basePrefs, notifications_garbage: true, notifications_recycling: true }
    const { getByText } = await renderLoaded({ auth: withAccount, prefs })
    expect(getByText('Garbage · Recycling')).toBeTruthy()
  })

  it('navigates straight to /notifications when an account already exists', async () => {
    const { getByLabelText } = await renderLoaded({ auth: withAccount })
    fireEvent.press(getByLabelText('Reminders settings'))
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/notifications')
    expect(enableReminders.enableRemindersForAddress).not.toHaveBeenCalled()
  })

  it('turns on reminders for a regular address then navigates to /notifications', async () => {
    ;(enableReminders.enableRemindersForAddress as jest.Mock).mockResolvedValue(undefined)
    const { getByLabelText } = await renderLoaded({ auth: noAccount, saved: savedRecord })

    await act(async () => {
      fireEvent.press(getByLabelText('Reminders settings'))
    })

    expect(enableReminders.enableRemindersForAddress).toHaveBeenCalledWith(
      '123 Main St', 'Springfield', 'NY', savedRecord.place, savedRecord.events
    )
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/notifications')
  })

  it('turns on reminders for a manual schedule then navigates to /notifications', async () => {
    ;(enableReminders.enableRemindersForManualSchedule as jest.Mock).mockResolvedValue(undefined)
    const { getByLabelText } = await renderLoaded({ auth: noAccount, saved: manualSavedRecord })

    await act(async () => {
      fireEvent.press(getByLabelText('Reminders settings'))
    })

    expect(enableReminders.enableRemindersForManualSchedule).toHaveBeenCalledWith(
      manualSavedRecord.manualSchedules
    )
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/notifications')
  })

  it('shows an error alert when turning on reminders fails', async () => {
    ;(enableReminders.enableRemindersForAddress as jest.Mock).mockRejectedValue(new Error('network error'))
    const { getByLabelText } = await renderLoaded({ auth: noAccount, saved: savedRecord })

    await act(async () => {
      fireEvent.press(getByLabelText('Reminders settings'))
    })

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not turn on reminders. Please try again.')
    const { router } = require('expo-router')
    expect(router.push).not.toHaveBeenCalledWith('/notifications')
  })

  it('navigates to /(tabs)/search when Address tile is pressed', async () => {
    const { getByLabelText } = await renderLoaded()
    fireEvent.press(getByLabelText('Change saved address'))
    const { router } = require('expo-router')
    expect(router.push).toHaveBeenCalledWith('/(tabs)/search')
  })

  it('shows confirmation Alert when "Delete my data" is pressed', async () => {
    const { getByText } = await renderLoaded()
    fireEvent.press(getByText('Delete my data'))
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete my data',
      'This will permanently delete your saved address and reminders. This cannot be undone.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ])
    )
  })

  it('deleting with no account clears local storage only, then navigates to /', async () => {
    const { getByText } = await renderLoaded({ auth: noAccount })
    fireEvent.press(getByText('Delete my data'))

    const buttons = alertSpy.mock.calls[0][2]
    const deleteButton = buttons.find((b: any) => b.text === 'Delete')

    await act(async () => {
      await deleteButton.onPress()
    })

    expect(savedAddress.clearSavedAddress).toHaveBeenCalledTimes(1)
    expect(userApi.deleteAccount).not.toHaveBeenCalled()
    expect(auth.signOut).not.toHaveBeenCalled()
    const { router } = require('expo-router')
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('deleting with an account clears local storage, deletes the account, and signs out', async () => {
    ;(userApi.deleteAccount as jest.Mock).mockResolvedValue(undefined)
    ;(auth.signOut as jest.Mock).mockResolvedValue(undefined)
    const { getByText } = await renderLoaded({ auth: withAccount })
    fireEvent.press(getByText('Delete my data'))

    const buttons = alertSpy.mock.calls[0][2]
    const deleteButton = buttons.find((b: any) => b.text === 'Delete')

    await act(async () => {
      await deleteButton.onPress()
    })

    expect(savedAddress.clearSavedAddress).toHaveBeenCalledTimes(1)
    expect(userApi.deleteAccount).toHaveBeenCalledTimes(1)
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    const { router } = require('expo-router')
    expect(router.replace).toHaveBeenCalledWith('/')
  })

  it('shows an error Alert when deleting fails', async () => {
    ;(userApi.deleteAccount as jest.Mock).mockRejectedValue(new Error('rpc error'))
    const { getByText } = await renderLoaded({ auth: withAccount })
    fireEvent.press(getByText('Delete my data'))

    const buttons = alertSpy.mock.calls[0][2]
    const deleteButton = buttons.find((b: any) => b.text === 'Delete')
    alertSpy.mockClear()

    await act(async () => {
      await deleteButton.onPress()
    })

    expect(alertSpy).toHaveBeenCalledWith('Error', 'Could not delete your data. Please try again.')
  })
})
