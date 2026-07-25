import { supabase } from './supabase'
import { signUp, signIn, signOut, getSession, changePassword } from './auth'

jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn(),
      updateUser: jest.fn(),
    },
  },
}))

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>

beforeEach(() => jest.clearAllMocks())

it('signUp calls supabase.auth.signUp with email and password', async () => {
  mockAuth.signUp.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  const result = await signUp('a@b.com', 'password123456')
  expect(mockAuth.signUp).toHaveBeenCalledWith({
    email: 'a@b.com',
    password: 'password123456',
    options: { emailRedirectTo: 'whenismy://' },
  })
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

it('changePassword returns error when current password is wrong', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: 'Invalid credentials' } } as any)
  const result = await changePassword('a@b.com', 'wrongpass', 'newpass12345678')
  expect(result).toEqual({ error: 'Current password is incorrect.' })
  expect(mockAuth.updateUser).not.toHaveBeenCalled()
})

it('changePassword returns supabase error when updateUser fails', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  mockAuth.updateUser.mockResolvedValueOnce({ data: {}, error: { message: 'Password too weak' } } as any)
  const result = await changePassword('a@b.com', 'currentpass123', 'newpass12345678')
  expect(result).toEqual({ error: 'Password too weak' })
})

it('changePassword returns { error: null } on success', async () => {
  mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  mockAuth.updateUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any)
  const result = await changePassword('a@b.com', 'currentpass123', 'newpass12345678')
  expect(result).toEqual({ error: null })
})
