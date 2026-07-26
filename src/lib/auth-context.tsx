import React, { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import * as Linking from 'expo-linking'
import { supabase } from './supabase'
import { registerPushToken } from './push-notifications'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user) registerPushToken(s.user.id)
    })

    // Handle email confirmation deep links (whenismy://?token_hash=...&type=signup)
    async function handleDeepLink({ url }: { url: string }) {
      const { queryParams } = Linking.parse(url)
      const token_hash = queryParams?.token_hash as string | undefined
      const type = queryParams?.type as string | undefined
      if (token_hash && type) {
        await supabase.auth.verifyOtp({ token_hash, type: type as any })
        // onAuthStateChange fires automatically with the new session
      }
    }

    // App already open when link is clicked
    const linkingSub = Linking.addEventListener('url', handleDeepLink)

    // App was closed and opened by the link
    Linking.getInitialURL().then(url => { if (url) handleDeepLink({ url }) })

    return () => {
      listener.subscription.unsubscribe()
      linkingSub.remove()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
