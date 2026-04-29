import { lookupSchedule, isError, lookupByCalendarUrl } from './api'

const mockPlace = {
  address_key: '123 main|springfield|ny',
  recollect_place_id: 'place-1',
  latitude: 40.7,
  longitude: -74.0,
  timezone: 'America/New_York',
  supported_event_types: ['garbage', 'recycling'],
}

const mockEvents = [
  { date: '2026-04-28', event_type: 'garbage' },
  { date: '2026-05-05', event_type: 'recycling' },
]

beforeEach(() => {
  global.fetch = jest.fn()
})

afterEach(() => jest.clearAllMocks())

describe('lookupSchedule', () => {
  it('returns LookupResponse on success', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ place: mockPlace, events: mockEvents }),
    })
    const result = await lookupSchedule('123 Main', 'Springfield', 'NY')
    expect(isError(result)).toBe(false)
    const r = result as any
    expect(r.place.recollect_place_id).toBe('place-1')
    expect(r.events).toHaveLength(2)
  })

  it('returns LookupError with notFound=true on 404', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ error: 'Address not found', notFound: true }),
    })
    const result = await lookupSchedule('99 Unknown St', 'Nowhere', 'XX')
    expect(isError(result)).toBe(true)
    expect((result as any).notFound).toBe(true)
  })

  it('returns LookupError on server error', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ error: 'Schedule data unavailable' }),
    })
    const result = await lookupSchedule('1 Main', 'City', 'CA')
    expect(isError(result)).toBe(true)
  })

  it('calls the correct URL with POST + JSON body', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ place: mockPlace, events: [] }),
    })
    await lookupSchedule('123 Main', 'Springfield', 'NY')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/lookup-schedule'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ street: '123 Main', city: 'Springfield', state: 'NY' }),
      })
    )
  })
})

describe('lookupByCalendarUrl', () => {
  it('posts ical_url and returns LookupResponse on success', async () => {
    const mockResponse = {
      place: {
        address_key: 'ical:BCCDF30E:208',
        recollect_place_id: 'BCCDF30E',
        provider: 'recollect-ical',
        latitude: null, longitude: null, timezone: null,
        supported_event_types: ['garbage'],
      },
      events: [{ date: '2026-05-01', event_type: 'garbage' }],
    }
    ;(fetch as jest.Mock).mockResolvedValueOnce({ json: () => Promise.resolve(mockResponse) })
    const url = 'https://recollect.a.ssl.fastly.net/api/places/BCCDF30E-578B-11E4-AD38-5839C200407A/services/208/events.en.ics'
    const result = await lookupByCalendarUrl(url)
    expect(isError(result)).toBe(false)
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/lookup-schedule'),
      expect.objectContaining({ body: JSON.stringify({ ical_url: url }) })
    )
  })
})
