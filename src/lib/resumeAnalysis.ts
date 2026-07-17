import { supabase } from './supabase'

/**
 * AI resume analysis (cloud-side via the `analyze-resume` edge function).
 * The Gemini call and PDF reading happen entirely in Supabase — the browser
 * only receives the extracted skills/specializations or a rejection.
 */

export type ResumeAnalysis =
  | { status: 'analyzed'; skills: string[]; specializations: string[] }
  | { status: 'no_skills_found'; message: string; suggestion: string | null }
  | { status: 'unsupported_format'; message: string }

/** Shown on the resume card when analysis found nothing to match. */
export const NO_SKILLS_MESSAGE =
  'Not applicable. No skills/specialization available to be matched.'

export async function analyzeResume(path: string): Promise<ResumeAnalysis> {
  const { data, error } = await supabase.functions.invoke('analyze-resume', {
    body: { path },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as ResumeAnalysis
}
