import { supabase } from './supabase'
import { signUp, signIn, signOut, getSession } from './auth'

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
    },
  },
}))

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>

beforeEach(() => jest.clearAllMocks())

it('signUp calls supabase.auth.signUp with email and password', async () => {
  mockAuth.signUp.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  const result = await signUp('a@b.com', 'password123456')
  expect(mockAuth.signUp).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123456' })
  expect(result.error).toBeNull()
})

it('signIn calls supabase.auth.signInWithPassword', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  const result = await signIn('a@b.com', 'password123456')
  expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123456' })
  expect(result.error).toBeNull()
})

it('signOut calls supabase.auth.signOut', async () => {
  mockAuth.signOut.mockResolvedValueOnce({ error: null })
  await signOut()
  expect(mockAuth.signOut).toHaveBeenCalled()
})

it('getSession returns current session', async () => {
  mockAuth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } }, error: null } as any)
  const session = await getSession()
  expect(session?.user.id).toBe('u1')
})
