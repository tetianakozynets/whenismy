import { supabase } from './supabase'

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// The only entry point into a Supabase account. Returns the existing
// session's user id if one exists, otherwise creates an anonymous session
// (no email, no password) and returns its user id.
export async function ensureAnonymousUser(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  if (data.session?.user) return data.session.user.id

  const { data: signInData, error } = await supabase.auth.signInAnonymously()
  if (error || !signInData.user) {
    throw error ?? new Error('Failed to create anonymous session')
  }
  return signInData.user.id
}
