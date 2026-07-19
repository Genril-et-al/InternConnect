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
  // Set once a recovery code is verified (see beginRecovery below).
  const [recovery, setRecovery] = useState(false)

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
    // NOTE: supabase-js holds an auth lock while this callback runs, and any
    // supabase query needs that same lock to attach the token — awaiting a
    // query here deadlocks (login hangs on "Finishing account setup…"). Defer
    // the profile fetch out of the callback so the lock is released first.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      // A recovery link opens a real session — flag it so the app routes to
      // the reset screen rather than dropping the user into the workspace.
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') setRecovery(false)
      setTimeout(() => {
        if (active) loadProfile(next?.user.id)
      }, 0)
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
      recovery,
      beginRecovery: () => setRecovery(true),
      endRecovery: () => setRecovery(false),
      refreshProfile: () => loadProfile(session?.user.id),
      signOut: async () => {
        if (demoProfile) {
          setDemoProfile(null)
          return
        }
        await authLogout()
        setSession(null)
        setProfile(null)
        setRecovery(false)
      },
      enterDemo: (p: Profile) => setDemoProfile(p),
      updateProfileLocal: (patch: Partial<Profile>) =>
        setDemoProfile((prev) => (prev ? { ...prev, ...patch } : prev)),
    }
  }, [session, profile, loading, demoProfile, recovery])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
