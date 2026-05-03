import { supabase } from './supabase'
import { saveAddress, savePickupEvents, getPreferences } from './user-api'
import { PlaceInfo, PickupEvent } from './types'

jest.mock('./supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn() },
    rpc: jest.fn(),
  },
}))

const mockFrom = supabase.from as jest.Mock
const mockRpc = supabase.rpc as jest.Mock

const place: PlaceInfo = {
  address_key: '123 main|springfield|ny',
  recollect_place_id: 'place-1',
  latitude: 40.7,
  longitude: -74.0,
  timezone: 'America/New_York',
  supported_event_types: ['garbage', 'recycling'],
  provider: 'recollect',
}

const events: PickupEvent[] = [
  { date: '2026-05-05', event_type: 'garbage' },
  { date: '2026-05-09', event_type: 'recycling' },
]

beforeEach(() => jest.clearAllMocks())

it('saveAddress upserts to user_preferences', async () => {
  const upsert = jest.fn().mockResolvedValueOnce({ error: null })
  mockFrom.mockReturnValueOnce({ upsert })
  await saveAddress('u1', '123 Main St', 'Springfield', 'NY', place)
  expect(mockFrom).toHaveBeenCalledWith('user_preferences')
  expect(upsert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'u1', city: 'Springfield', state: 'NY' }),
    { onConflict: 'user_id' }
  )
})

it('savePickupEvents inserts events with user_id and source', async () => {
  const insert = jest.fn().mockResolvedValueOnce({ error: null })
  mockFrom.mockReturnValueOnce({ insert })
  await savePickupEvents('u1', events)
  expect(mockFrom).toHaveBeenCalledWith('pickup_events')
  expect(insert).toHaveBeenCalledWith(
    events.map(e => ({
      user_id: 'u1',
      event_date: e.date,
      event_type: e.event_type,
      source: 'recollect',
      refreshed_at: expect.any(String),
    }))
  )
})

it('getPreferences selects from user_preferences by user_id', async () => {
  const single = jest.fn().mockResolvedValueOnce({ data: { user_id: 'u1' }, error: null })
  const eq = jest.fn().mockReturnValueOnce({ single })
  const select = jest.fn().mockReturnValueOnce({ eq })
  mockFrom.mockReturnValueOnce({ select })
  const result = await getPreferences('u1')
  expect(result?.user_id).toBe('u1')
})
