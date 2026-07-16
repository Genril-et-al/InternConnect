import { supabase } from './supabase'
import type { Profile } from './supabase'

/**
 * Auth service for InternConnect (UC-S01 — Register & Login).
 *
 * Registration is a 3-step flow that mirrors the use case:
 *   1. requestSignupCode()  — email a 6-digit verification code
 *   2. verifySignupCode()   — confirm the code, opening an authenticated session
 *   3. setPassword()        — set the password used for future logins
 *
 * Domain rules (only @cit.edu students, or NLO-approved companies) are enforced
 * server-side by the `handle_new_user` trigger, so an invalid email fails at
 * step 1 with a descriptive error.
 */

const UNIVERSITY_DOMAIN = '@cit.edu'

export function isUniversityEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(UNIVERSITY_DOMAIN)
}

export type SignupName = {
  firstName: string
  middleInitial: string
  lastName: string
}

/** Step 1: send a verification code to the email (creates the pending user). */
export async function requestSignupCode(email: string, name: SignupName) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      data: {
        first_name: name.firstName.trim(),
        middle_initial: name.middleInitial.trim(),
        last_name: name.lastName.trim(),
      },
    },
  })
  if (error) throw error
}

/** Step 2: verify the 6-digit code; on success a session (JWT) is established. */
export async function verifySignupCode(email: string, code: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: 'email',
  })
  if (error) throw error
  return data
}

/** Step 3: set the password used for future email+password logins. */
export async function setPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

/** Login with email + password (UC-S01 step 7). */
export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  if (error) throw error
  return data
}

export async function logout() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/** Fetch the current user's application profile (role, name, active flag). */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data as Profile | null
}
