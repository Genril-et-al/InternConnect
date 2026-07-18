import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '../lib/supabase'

export type AuthState = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  /** True when running as the offline demo student (no Supabase). */
  demo: boolean
  /**
   * True while the session came from a password-recovery link, so the app
   * shows the "set a new password" screen instead of the workspace.
   */
  recovery: boolean
  /** Leave recovery mode (password changed, or the user cancelled). */
  endRecovery: () => void
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  /** Enter offline demo mode with the given profile (demo builds only). */
  enterDemo: (profile: Profile) => void
  /** Merge a patch into the current profile locally (used by the demo). */
  updateProfileLocal: (patch: Partial<Profile>) => void
}

export const AuthContext = createContext<AuthState | undefined>(undefined)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
