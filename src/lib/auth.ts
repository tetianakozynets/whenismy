import { supabase } from './supabase'

export async function signUp(email: string, password: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: 'whenismy://' },
  })
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  const { error: signInError } = await signIn(email, currentPassword)
  if (signInError) return { error: 'Current password is incorrect.' }
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) return { error: updateError.message }
  return { error: null }
}
