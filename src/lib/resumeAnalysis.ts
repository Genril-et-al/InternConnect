import { supabase } from './supabase'

/**
 * AI resume analysis (cloud-side via the `analyze-resume` edge function).
 * The Gemini call and PDF reading happen entirely in Supabase — the browser
 * only receives the extracted skills/specializations or a rejection.
 */

export type ResumeAnalysis =
  | { status: 'analyzed'; skills: string[]; specializations: string[] }
  | { status: 'no_skills_found'; message: string; suggestion: string | null }
  | { status: 'name_mismatch'; message: string; suggestion: string | null }
  | { status: 'unsupported_format'; message: string }

/** Shown on the resume card when analysis found nothing to match. */
export const NO_SKILLS_MESSAGE =
  'Not applicable. No skills/specialization available to be matched.'

/** Shown when the resume names someone other than the account holder. */
export const NAME_MISMATCH_MESSAGE =
  'The name on this resume does not match your InternConnect account.'

export async function analyzeResume(path: string): Promise<ResumeAnalysis> {
  // supabase-js only refreshes the access token on a timer, so a tab left open
  // past the 1-hour expiry sends a stale JWT and the function answers 401.
  // getSession() refreshes an expired token before we read it.
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) {
    throw new Error('Your session has expired. Please sign in again and retry.')
  }

  const { data, error } = await supabase.functions.invoke('analyze-resume', {
    body: { path },
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (error) {
    // A non-2xx response carries the useful body (including `detail`), which
    // supabase-js hides behind a generic FunctionsHttpError.
    const context = (error as { context?: Response }).context
    if (context && typeof context.json === 'function') {
      try {
        const body = await context.json()
        throw new Error(describeFailure(body))
      } catch (parsed) {
        if (parsed instanceof Error && parsed.message) throw parsed
      }
    }
    throw error
  }
  if (data?.error) throw new Error(describeFailure(data))
  return data as ResumeAnalysis
}

/** Include the provider detail so a failure is diagnosable from the UI. */
function describeFailure(body: { error?: string; detail?: string }): string {
  // The function's own auth failure is opaque to a student — say what to do.
  if (body.error === 'Not authenticated') {
    return 'Your session has expired. Please sign in again and retry.'
  }
  const message = body.error || 'Resume analysis failed.'
  return body.detail ? `${message} — ${body.detail}` : message
}
