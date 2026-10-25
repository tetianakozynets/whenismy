import { supabase } from './supabase'
import { signOut, getSession, ensureAnonymousUser } from './auth'

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
      getSession: jest.fn(),
      signInAnonymously: jest.fn(),
    },
  },
}))

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>

beforeEach(() => jest.clearAllMocks())

it('signOut calls supabase.auth.signOut', async () => {
  mockAuth.signOut.mockResolvedValueOnce({ error: null } as any)
  await signOut()
  expect(mockAuth.signOut).toHaveBeenCalled()
})

it('getSession returns the current session', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null } as any)
  const session = await getSession()
  expect(session?.user.id).toBe('u1')
})

it('ensureAnonymousUser returns the existing session user id without signing in again', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null } as any)
  const id = await ensureAnonymousUser()
  expect(id).toBe('u1')
  expect(mockAuth.signInAnonymously).not.toHaveBeenCalled()
})

it('ensureAnonymousUser signs in anonymously when there is no session', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any)
  mockAuth.signInAnonymously.mockResolvedValueOnce({ data: { user: { id: 'u2' }, session: {} }, error: null } as any)
  const id = await ensureAnonymousUser()
  expect(id).toBe('u2')
  expect(mockAuth.signInAnonymously).toHaveBeenCalledTimes(1)
})

it('ensureAnonymousUser throws when signInAnonymously fails', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null } as any)
  mockAuth.signInAnonymously.mockResolvedValueOnce({
    data: { user: null, session: null },
    error: { message: 'network error' },
  } as any)
  await expect(ensureAnonymousUser()).rejects.toBeTruthy()
})
