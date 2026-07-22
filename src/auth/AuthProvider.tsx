import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import { fetchProfile, logout as authLogout } from '../lib/auth'
import { AuthContext } from './context'
import type { AuthState } from './context'

// Kept in step with .signout-veil in auth.css — the veil's fade-in has to have
// finished before the session is cleared, and it must stay mounted for the
// whole of its fade-out.
const VEIL_IN_MS = 400
const VEIL_OUT_MS = 420

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  // Offline demo student (only used when Supabase is not connected).
  const [demoProfile, setDemoProfile] = useState<Profile | null>(null)
  // Set once a recovery code is verified (see beginRecovery below).
  const [recovery, setRecovery] = useState(false)
  // Sign-out veil: 'out' covers the workspace while the session is torn down,
  // 'fading' holds it over the freshly mounted login screen for one fade so the
  // two never swap in a single frame. See signOut below.
  const [signOutPhase, setSignOutPhase] = useState<'idle' | 'out' | 'fading'>('idle')

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
      signingOut: signOutPhase !== 'idle',
      signOut: async () => {
        if (signOutPhase !== 'idle') return
        setSignOutPhase('out')
        // The veil needs a moment to cover the workspace before the session
        // disappears underneath it — without the floor, a fast sign-out swaps
        // the workspace for the login screen while the veil is still ramping
        // in, which is the jump this whole thing exists to remove. Demo mode
        // is synchronous and would otherwise flash the veil for one frame.
        const covered = new Promise((resolve) => setTimeout(resolve, VEIL_IN_MS))
        try {
          if (demoProfile) {
            await covered
            setDemoProfile(null)
          } else {
            await Promise.all([authLogout(), covered])
            setSession(null)
            setProfile(null)
            setRecovery(false)
          }
        } catch (err) {
          // Sign-out failed — drop the veil and leave the user where they were
          // rather than stranding them behind it.
          setSignOutPhase('idle')
          throw err
        }
        // The login screen mounts on this render; hold the veil over it for one
        // fade so it dissolves into the new page instead of being cut away.
        setSignOutPhase('fading')
        setTimeout(() => setSignOutPhase('idle'), VEIL_OUT_MS)
      },
      enterDemo: (p: Profile) => setDemoProfile(p),
      updateProfileLocal: (patch: Partial<Profile>) =>
        setDemoProfile((prev) => (prev ? { ...prev, ...patch } : prev)),
    }
  }, [session, profile, loading, demoProfile, recovery, signOutPhase])

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Rendered here rather than in App so it covers every shell that offers
          a sign-out — student, company, admin, and profile setup — without each
          one having to thread the state through its own early returns. */}
      {signOutPhase !== 'idle' && (
        <div
          aria-live="polite"
          className={`auth-loading signout-veil${signOutPhase === 'fading' ? ' leaving' : ''}`}
          role="status"
        >
          <span className="ic-spinner" aria-hidden="true" />
          <p>Signing you out…</p>
        </div>
      )}
    </AuthContext.Provider>
  )
}
