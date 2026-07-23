import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Whether real Supabase credentials are present. When false, the app still
 * renders (so you can see the UI), but any auth call will fail until you add
 * your keys to .env.local — see docs/SUPABASE_SETUP.md.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // Warn instead of throwing, so a missing .env.local doesn't blank the app.
  console.warn(
    '[InternConnect] Supabase is not configured. Copy .env.example to ' +
      '.env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
      'The UI will render, but login/signup will not work until then.',
  )
}

/**
 * Browser Supabase client. Persists the session (JWT access + refresh) in
 * localStorage and auto-refreshes the access token, so the user stays logged
 * in across reloads. Falls back to harmless placeholder values when the env
 * is missing so the app boots and the UI is visible.
 */
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)

export type UserRole = 'student' | 'company' | 'admin'

export type Profile = {
  id: string
  role: UserRole
  email: string
  full_name: string | null
  first_name: string | null
  middle_initial: string | null
  last_name: string | null
  suffix: string | null
  age: number | null
  gender: string | null
  address: string | null
  personal_email: string | null
  contact_number: string | null
  photo_url: string | null
  skills: string[]
  specializations: string[]
  ai_skills: string[]
  ai_specializations: string[]
  resume_url: string | null
  cover_letter_url: string | null
  resume_status: 'pending_analysis' | 'analyzed' | 'no_skills_found' | 'name_mismatch' | null
  resume_analyzed_at: string | null
  resume_ai_suggestion: string | null
  portfolio_link: string | null
  portfolio_file_url: string | null
  profile_completed: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}
