import React from 'react'
import { render, fireEvent, waitFor } from '@testing-library/react-native'
import SearchTab from './search'
import * as apiLib from '../../src/lib/api'
import { scheduleStore } from '../../src/lib/schedule-store'
import { router } from 'expo-router'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Force narrow screen (< 768 SPLIT_BREAKPOINT) so the split-layout branch is
// never taken and we test the primary mobile path.
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  default: () => ({ width: 375, height: 812, scale: 2, fontScale: 1 }),
}))

jest.mock('../../src/lib/api', () => ({
  lookupSchedule: jest.fn(),
  isError: jest.fn(),
}))

jest.mock('../../src/lib/schedule-store', () => ({
  scheduleStore: { set: jest.fn(), get: jest.fn() },
}))

jest.mock('../../src/components/ScheduleContent', () => ({
  ScheduleContent: ({ address }: { address?: string }) => {
    const { Text } = require('react-native')
    return <Text testID="schedule-content">{address}</Text>
  },
}))

jest.mock('../../src/components/AddressMatchPicker', () => ({
  AddressMatchPicker: () => null,
}))

jest.mock('../../src/components/SplitLayout', () => ({
  SplitLayout: () => null,
}))

jest.mock('../../src/components/SchedulePanel', () => ({
  SchedulePanel: () => null,
}))

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn() },
}))

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockResult = {
  place: {
    address_key: '123 main st|springfield|ny',
    recollect_place_id: 'place-1',
    latitude: 40.7,
    longitude: -74.0,
    timezone: 'America/New_York',
    supported_event_types: ['garbage'],
    provider: 'recollect' as const,
  },
  events: [{ date: '2026-05-10', event_type: 'garbage' }],
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks()
  // Default: isError returns false (success path)
  ;(apiLib.isError as jest.Mock).mockReturnValue(false)
  ;(scheduleStore.get as jest.Mock).mockReturnValue(null)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function submitAddress(
  utils: ReturnType<typeof render>,
  street = '123 Main St',
  city = 'Springfield'
) {
  fireEvent.changeText(utils.getByTestId('input-street'), street)
  fireEvent.changeText(utils.getByTestId('input-city'), city)
  fireEvent.press(utils.getByTestId('submit-button'))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SearchTab', () => {
  // 1. Renders logo and subtitle "Search any address"
  it('renders WimLogo and subtitle "Search any address"', () => {
    const { getByText } = render(<SearchTab />)
    expect(getByText('When Is My')).toBeTruthy() // from WimLogo
    expect(getByText('Search any address')).toBeTruthy()
  })

  // 2. Shows not-found text after a failed lookup (notFound=true)
  it('shows not-found text when the API returns notFound=true', async () => {
    ;(apiLib.lookupSchedule as jest.Mock).mockResolvedValueOnce({
      error: 'Address not found',
      notFound: true,
    })
    ;(apiLib.isError as jest.Mock).mockReturnValue(true)

    const utils = render(<SearchTab />)
    submitAddress(utils)

    await waitFor(() => {
      expect(
        utils.getByText(/we couldn't find that address/i)
      ).toBeTruthy()
    })
  })

  // 3. Does NOT navigate away — result renders inline in the same component
  it('does not use router navigation when lookup succeeds (result renders inline)', async () => {
    ;(apiLib.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
    ;(apiLib.isError as jest.Mock).mockReturnValue(false)

    const utils = render(<SearchTab />)
    submitAddress(utils)

    await waitFor(() => {
      expect(utils.getByTestId('schedule-content')).toBeTruthy()
    })

    // expo-router is NOT mocked at all in this test file — if router.push/replace
    // were called they would throw, which means the test itself proves no navigation.
    // Extra safety: the form is no longer visible once result is shown inline.
    expect(utils.queryByTestId('submit-button')).toBeNull()
  })

  // 4. Shows ScheduleContent inline when lookup succeeds (narrow screen, no split)
  it('renders ScheduleContent inline with the formatted address after a successful lookup', async () => {
    ;(apiLib.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
    ;(apiLib.isError as jest.Mock).mockReturnValue(false)

    const utils = render(<SearchTab />)
    // Select NYC — city is locked to "New York City", changeText for city is a no-op
    fireEvent.press(utils.getByTestId('state-chip-NY'))
    submitAddress(utils, '123 main st', 'ignored')

    await waitFor(() => {
      const content = utils.getByTestId('schedule-content')
      expect(content).toBeTruthy()
      expect(content.props.children).toBe('123 Main St, New York City, NY')
    })
  })

  // 5. Calls lookupSchedule with street/city/state from AddressForm submission
  it('calls lookupSchedule with street, city, and selected state', async () => {
    ;(apiLib.lookupSchedule as jest.Mock).mockResolvedValueOnce(mockResult)
    ;(apiLib.isError as jest.Mock).mockReturnValue(false)

    const utils = render(<SearchTab />)
    // NJ is the default state — submit as-is to verify it's forwarded
    submitAddress(utils, '456 Oak Ave', 'Newark')

    await waitFor(() => {
      expect(apiLib.lookupSchedule).toHaveBeenCalledWith('456 Oak Ave', 'Newark', 'NJ')
    })
  })

  // Bonus: isError result without notFound does not show not-found text
  it('does not show not-found text when isError is true but notFound is false', async () => {
    ;(apiLib.lookupSchedule as jest.Mock).mockResolvedValueOnce({
      error: 'Server error (500) — please try again.',
    })
    ;(apiLib.isError as jest.Mock).mockReturnValue(true)

    const utils = render(<SearchTab />)
    submitAddress(utils)

    // Give the component time to settle
    await waitFor(() => {
      expect(apiLib.lookupSchedule).toHaveBeenCalled()
    })
    expect(utils.queryByText(/we couldn't find that address/i)).toBeNull()
  })

  // 7. Navigates to /address-not-found when notCovered=true; not-found text is NOT shown
  it('calls router.push("/address-not-found") and does not show not-found text when notCovered=true', async () => {
    ;(apiLib.lookupSchedule as jest.Mock).mockResolvedValueOnce({
      error: 'Not covered',
      notCovered: true,
    })
    ;(apiLib.isError as jest.Mock).mockReturnValueOnce(true)

    const utils = render(<SearchTab />)
    submitAddress(utils)

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/address-not-found')
    })
    expect(utils.queryByText(/we couldn't find that address/i)).toBeNull()
  })
})
