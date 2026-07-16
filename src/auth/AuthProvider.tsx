import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { fetchProfile, logout as authLogout } from '../lib/auth'
import { AuthContext } from './context'
import type { AuthState } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Offline demo student (only used when Supabase is not connected).
  const [demoProfile, setDemoProfile] = useState<Profile | null>(null)

  async function loadProfile(userId: string | undefined) {
    if (!userId) {
      setProfile(null)
      return
    }
    try {
      setProfile(await fetchProfile(userId))
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    let active = true

    // Initial session (from persisted storage).
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      if (active) setLoading(false)
    })

    // Keep in sync with sign-in / sign-out / token refresh.
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next)
      await loadProfile(next?.user.id)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(() => {
    // A demo profile takes precedence and provides a mock session so the app's
    // auth gate treats it like a signed-in user.
    const effectiveSession = demoProfile
      ? ({ user: { id: demoProfile.id } } as unknown as Session)
      : session
    const effectiveProfile = demoProfile ?? profile

    return {
      session: effectiveSession,
      profile: effectiveProfile,
      loading,
      demo: demoProfile !== null,
      refreshProfile: () => loadProfile(session?.user.id),
      signOut: async () => {
        if (demoProfile) {
          setDemoProfile(null)
          return
        }
        await authLogout()
        setSession(null)
        setProfile(null)
      },
      enterDemo: (p: Profile) => setDemoProfile(p),
      updateProfileLocal: (patch: Partial<Profile>) =>
        setDemoProfile((prev) => (prev ? { ...prev, ...patch } : prev)),
    }
  }, [session, profile, loading, demoProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
