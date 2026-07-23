import { supabase } from './supabase'
import type { Profile } from './supabase'
import { formatMiddleInitial } from './name'

/**
 * Auth service for InternConnect (UC-S01 — Register & Login).
 *
 * Registration is a 3-step flow that mirrors the use case:
 *   1. requestSignupCode()  — email a 6-digit verification code
 *   2. verifySignupCode()   — confirm the code, opening an authenticated session
 *   3. setPassword()        — set the password used for future logins
 *
 * Eligibility is roster-based, not domain-based: the `handle_new_user` trigger
 * (via `resolve_signup_role`) allows an email only if it is on the
 * `approved_students` roster or the `nlo_approved_companies` allowlist —
 * regardless of domain. A non-rostered email fails at step 1 with a
 * descriptive server error, so no client-side domain check is needed.
 */

/**
 * Sign-up collects the student's full name and university email (UC-S01),
 * plus a few contact details. Everything else is filled in later on the
 * profile. `personalEmail` is contact detail only — the verification code
 * always goes to the university email.
 */
export type SignupName = {
  firstName: string
  middleInitial: string
  lastName: string
  suffix: string
  address?: string
  contactNumber?: string
  personalEmail?: string
}

/**
 * Pre-check whether an email is cleared to register, by asking the database
 * (approved_students roster / nlo_approved_companies allowlist). Returns the
 * resolved role, or null if the email is not permitted. Used to give a clear
 * message before requesting a code (UC-S01), instead of a generic 500.
 */
export async function checkSignupEligibility(
  email: string,
): Promise<'student' | 'company' | null> {
  const { data, error } = await supabase.rpc('check_signup_eligibility', {
    p_email: email.trim().toLowerCase(),
  })
  if (error) throw error
  return (data as 'student' | 'company' | null) ?? null
}

/**
 * Step 1: send a verification code to `email` (creates the pending user).
 *
 * `email` is the institutional address — the university email for students,
 * the work email for companies — and it is both identity and delivery: the
 * code is mailed to the same inbox the roster is keyed on, so receiving it
 * proves control of that mailbox.
 *
 * This replaces the split introduced in migration 0013, where students named a
 * personal inbox and the code went there instead. A personal email is still
 * collected, but only as profile contact detail; it no longer receives mail
 * and is no longer what they log in with.
 */
export async function requestSignupCode(email: string, name: SignupName) {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      data: {
        first_name: name.firstName.trim(),
        middle_initial: formatMiddleInitial(name.middleInitial),
        last_name: name.lastName.trim(),
        suffix: name.suffix.trim(),
        address: name.address?.trim() || null,
        contact_number: name.contactNumber?.trim() || null,
        personal_email: name.personalEmail?.trim() || null,
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

/**
 * Password recovery is code-based, mirroring signup:
 *   1. requestPasswordReset()    — email a 6-digit recovery code
 *   2. verifyPasswordResetCode() — confirm it, opening an authenticated session
 *   3. setPassword()             — set the new password on that session
 *
 * Both steps go through the `password-reset` edge function rather than calling
 * supabase.auth directly. Accounts created while migration 0013 was in force
 * authenticate with a PERSONAL address even though the student types their
 * UNIVERSITY email, and only the server may hold that mapping — exposing it to
 * a logged-out caller would let anyone harvest personal addresses by guessing
 * firstname.lastname@cit.edu.
 *
 * Everyone else — companies, and students registered before 0013 or after the
 * revert — resolves to the same address they typed, so one path serves both.
 */

/**
 * Ask for a recovery code. Always resolves, whether or not the email exists —
 * an error here would let anyone probe which addresses are registered.
 */
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.functions.invoke('password-reset', {
    body: { action: 'request', email: email.trim().toLowerCase() },
  })
  // Log for debugging, but don't surface it: the UI shows the same
  // "if that email exists, check your inbox" message either way.
  if (error) console.warn('[InternConnect] password reset request failed:', error.message)
}

/**
 * Verify the 6-digit recovery code and adopt the session it opens.
 *
 * The function verifies server-side (it knows the delivery address; we don't)
 * and returns the tokens, which setSession() installs so setPassword() has an
 * authenticated session to update.
 *
 * Unlike requestPasswordReset(), this throws: once someone is typing a code
 * there is no address to disclose, and a wrong or expired code must be shown.
 */
export async function verifyPasswordResetCode(email: string, code: string) {
  const { data, error } = await supabase.functions.invoke('password-reset', {
    body: {
      action: 'verify',
      email: email.trim().toLowerCase(),
      code: code.trim(),
    },
  })
  // A non-2xx reply arrives as FunctionsHttpError with the body unread, so the
  // server's message has to be pulled out of the response before it's usable.
  if (error) {
    let message = 'That code is not valid or has expired.'
    const res = (error as { context?: Response }).context
    if (res && typeof res.json === 'function') {
      try {
        const body = await res.json()
        if (body?.error) message = String(body.error)
      } catch {
        // Keep the default message.
      }
    }
    throw new Error(message)
  }
  if (!data?.access_token || !data?.refresh_token) {
    throw new Error('That code is not valid or has expired.')
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  })
  if (sessionError) throw sessionError
  return data
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
