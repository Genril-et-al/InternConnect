// InternConnect — analyze-resume edge function
//
// Reads the calling student's resume PDF from the private `documents` bucket,
// sends it to Gemini (cloud-side only — the API key and PDF never reach the
// browser), and extracts skills + specializations as structured JSON.
//
// Result statuses:
//   analyzed           — skills/specializations extracted; UI pre-fills tags
//   no_skills_found    — nothing to match; profile flagged, re-upload required
//   unsupported_format — resume is not a PDF; Gemini can only read PDFs inline
//
// Secrets required (supabase secrets set ...):
//   GEMINI_API_KEY — Google AI Studio key
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the platform.

import { createClient } from 'npm:@supabase/supabase-js@2'

// Tried in order. Two independent things can go wrong per model, and they need
// opposite responses:
//   * permanent (404/400/403) — this key's project cannot use the model at all
//     (e.g. gemini-2.5-flash is closed to keys created after its cutoff).
//     Retrying is pointless; move to the next model immediately.
//   * transient (429/500/503) — the model exists but Google is throttling or
//     overloaded. Moving on wastes a working model; retry with backoff first.
// Keep the list ordered widest-availability-first so the common path is one
// call, and always keep at least one older-generation model as a last resort.
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.0-flash-001',
  'gemini-2.5-flash-lite',
]

/** Statuses worth retrying on the same model before falling through. */
const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504])
const RETRIES_PER_MODEL = 2
const RETRY_BASE_MS = 700

const geminiUrl = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Extraction = {
  is_valid_resume: boolean
  candidate_name: string
  skills: string[]
  specializations: string[]
  suggestion: string
}

const EXTRACTION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_valid_resume: {
      type: 'BOOLEAN',
      description: 'True only if the document is actually a resume/CV.',
    },
    candidate_name: {
      type: 'STRING',
      description:
        "The candidate's own full name exactly as printed on the resume — " +
        'usually the heading at the top. Do NOT include titles, degrees, or ' +
        'contact lines. Empty string if the resume states no name.',
    },
    skills: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description:
        'Concrete skills found in the resume (languages, tools, frameworks, soft skills). ' +
        'Normalize names: "ReactJS"/"React.js" -> "React", "MS Excel" -> "Excel". ' +
        'Empty if none are stated.',
    },
    specializations: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      description:
        'Broad areas of focus, e.g. "Frontend Development", "Backend Development", ' +
        '"Marketing", "Data Analytics", "UI/UX Design". Empty if none can be inferred.',
    },
    suggestion: {
      type: 'STRING',
      description:
        'Only when skills AND specializations are empty (or the file is not a resume): ' +
        'one or two sentences telling the student what to add so their resume can be ' +
        'matched to internships (e.g. add a Skills section listing tools and languages). ' +
        'Empty string otherwise.',
    },
  },
  required: ['is_valid_resume', 'candidate_name', 'skills', 'specializations', 'suggestion'],
}

const PROMPT =
  'You are the resume analyzer for InternConnect, an internship matching platform. ' +
  'Read the attached document. If it is a resume/CV, extract the candidate\'s full name, ' +
  'skills and specializations exactly per the response schema. Report the name exactly as ' +
  'written on the resume, and only report skills actually evidenced in the document — do ' +
  'not invent any. If the document is not a resume, or contains no identifiable skills or ' +
  'specializations, return empty arrays and fill `suggestion` with concrete advice for ' +
  'making the resume matchable to internships.'

/** Shown to the student when the resume names someone other than the account holder. */
const NAME_MISMATCH_MESSAGE =
  'The name on this resume does not match your InternConnect account.'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiKey) return json({ error: 'GEMINI_API_KEY is not configured' }, 500)

    // 1. Identify the caller from their JWT — only students analyze their own resume.
    const authHeader = req.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401)
    const uid = userData.user.id

    const admin = createClient(supabaseUrl, serviceKey)

    // 2. Locate the resume. The path is pinned to the caller's own folder, so the
    //    service-role download cannot be pointed at another student's files.
    const { data: profileRow, error: profileError } = await admin
      .from('profiles')
      .select('resume_url, role, full_name, first_name, middle_initial, last_name, suffix')
      .eq('id', uid)
      .single()
    if (profileError) return json({ error: profileError.message }, 500)
    if (profileRow.role !== 'student') {
      return json({ error: 'Only student accounts have resumes to analyze' }, 403)
    }

    // Allow the client to pass the just-uploaded path (before the profile row is
    // saved), but only accept paths inside the caller's own folder.
    let path: string | null = null
    try {
      const body = await req.json()
      if (typeof body?.path === 'string') path = body.path
    } catch {
      /* no body — fall back to the stored resume path */
    }
    if (!path) path = profileRow.resume_url
    if (!path) return json({ error: 'No resume on file. Upload one first.' }, 400)
    if (!path.startsWith(`${uid}/`)) {
      return json({ error: 'Path does not belong to the caller' }, 403)
    }

    if (!path.toLowerCase().endsWith('.pdf')) {
      return json({
        status: 'unsupported_format',
        message: 'Only PDF resumes can be analyzed. Please upload your resume as a PDF.',
      })
    }

    // 3. Download the PDF from the private bucket (cloud-side only).
    const { data: file, error: downloadError } = await admin.storage
      .from('documents')
      .download(path)
    if (downloadError || !file) {
      return json({ error: `Could not read resume: ${downloadError?.message}` }, 500)
    }
    const bytes = new Uint8Array(await file.arrayBuffer())
    let binary = ''
    const CHUNK = 0x8000
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
    }
    const base64 = btoa(binary)

    // 4. Ask Gemini for a structured extraction, trying each model in turn.
    const requestBody = JSON.stringify({
      contents: [{
        parts: [
          { text: PROMPT },
          { inline_data: { mime_type: 'application/pdf', data: base64 } },
        ],
      }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        responseSchema: EXTRACTION_SCHEMA,
      },
    })

    let geminiBody: Record<string, unknown> | null = null
    const attempts: string[] = []

    model: for (const model of GEMINI_MODELS) {
      for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt++) {
        if (attempt > 0) await sleep(RETRY_BASE_MS * 2 ** (attempt - 1))

        let res: Response
        try {
          res = await fetch(geminiUrl(model), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
            body: requestBody,
          })
        } catch (err) {
          // Network/DNS failure reaching Google at all — worth one more try.
          attempts.push(
            `${model}: fetch failed — ${err instanceof Error ? err.message : String(err)}`,
          )
          continue
        }
        if (res.ok) {
          geminiBody = await res.json()
          break model
        }
        // Capture Google's own message; this is what actually explains a failure
        // (bad key, API not enabled, quota exhausted, model not available).
        const detail = await res.text()
        attempts.push(`${model}: HTTP ${res.status} — ${detail.slice(0, 300)}`)
        console.error('Gemini error', model, res.status, detail)
        if (!TRANSIENT_STATUSES.has(res.status)) continue model
      }
    }

    if (!geminiBody) {
      const summary = attempts.join(' | ')
      await admin.from('edge_function_errors').insert({
        fn: 'analyze-resume',
        detail: summary.slice(0, 4000),
      })
      // The full provider payload goes to `edge_function_errors` for the team.
      // The student gets a short status-code trail — enough for them to quote in
      // a bug report, without a wall of Google's JSON in the middle of the form.
      const codes = attempts.map((a) => a.split(' — ')[0]).join(', ')
      return json(
        {
          error: 'AI analysis is temporarily unavailable. Please try again in a few minutes.',
          detail: codes.slice(0, 300),
        },
        502,
      )
    }

    const text = (geminiBody as {
      candidates?: { content?: { parts?: { text?: string }[] } }[]
    })?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      await admin.from('edge_function_errors').insert({
        fn: 'analyze-resume',
        detail: `Empty Gemini response: ${JSON.stringify(geminiBody).slice(0, 2000)}`,
      })
      return json({ error: 'AI returned no result. Please try again.' }, 502)
    }
    const extraction = JSON.parse(text) as Extraction

    // Identity check. A resume made out to someone else is either the wrong file
    // or another person's — either way it must not seed this student's skills,
    // and matching an internship to it would misrepresent the applicant. Only
    // enforced when the document is a real resume that actually states a name;
    // an unreadable/absent name can't be verified, so it isn't blocked here.
    if (extraction.is_valid_resume && extraction.candidate_name?.trim()) {
      if (!nameMatchesProfile(profileRow, extraction.candidate_name)) {
        const profileName = profileFullName(profileRow)
        const resumeName = extraction.candidate_name.trim()
        const detail =
          `Your account name is "${profileName}", but this resume is made out to ` +
          `"${resumeName}". Please upload your own resume. If your legal name recently ` +
          'changed, ask your coordinator to update it on your account.'
        const { error: mismatchError } = await admin
          .from('profiles')
          .update({
            resume_status: 'name_mismatch',
            resume_analyzed_at: new Date().toISOString(),
            resume_ai_suggestion: detail,
            ai_skills: [],
            ai_specializations: [],
          })
          .eq('id', uid)
        if (mismatchError) return json({ error: mismatchError.message }, 500)
        return json({
          status: 'name_mismatch',
          message: NAME_MISMATCH_MESSAGE,
          suggestion: detail,
        })
      }
    }

    const skills = dedupe(extraction.skills)
    const specializations = dedupe(extraction.specializations)
    const empty = !extraction.is_valid_resume ||
      (skills.length === 0 && specializations.length === 0)

    // 5. Record the outcome on the profile (skills themselves are only written
    //    after the student confirms them in the UI).
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        resume_status: empty ? 'no_skills_found' : 'analyzed',
        resume_analyzed_at: new Date().toISOString(),
        resume_ai_suggestion: empty ? (extraction.suggestion || null) : null,
        ai_skills: empty ? [] : skills,
        ai_specializations: empty ? [] : specializations,
      })
      .eq('id', uid)
    if (updateError) return json({ error: updateError.message }, 500)

    if (empty) {
      return json({
        status: 'no_skills_found',
        message:
          'Not applicable. No skills/specialization available to be matched.',
        suggestion: extraction.suggestion || null,
      })
    }
    return json({ status: 'analyzed', skills, specializations })
  } catch (err) {
    console.error('analyze-resume failed', err)
    return json({ error: 'Unexpected error during resume analysis.' }, 500)
  }
})

type ProfileNameParts = {
  full_name?: string | null
  first_name?: string | null
  middle_initial?: string | null
  last_name?: string | null
  suffix?: string | null
}

/** Human-readable account name for the mismatch message. */
function profileFullName(p: ProfileNameParts): string {
  if (p.full_name?.trim()) return p.full_name.trim()
  return [p.first_name, p.middle_initial, p.last_name, p.suffix]
    .map((s) => (s ?? '').trim())
    .filter(Boolean)
    .join(' ')
}

/**
 * Split a name into comparable tokens: strip diacritics, lowercase, keep only
 * letters/digits, and drop one-character fragments (initials, particles) so
 * "José D. Dela-Cruz" and "Jose Dela Cruz" reduce to the same set.
 */
function nameTokens(s: string): string[] {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
}

/**
 * True if one name-part of the account (e.g. the last name) is represented in
 * the resume's name. A single shared token is enough, so a two-part given name
 * stored as "Maria Cristina" still matches a resume that prints only "Cristina".
 * Compound surnames written solid ("Dela Cruz" -> "delacruz") match via the
 * joined form.
 */
function partPresent(partTokens: string[], resumeSet: Set<string>, resumeJoined: string): boolean {
  if (partTokens.length === 0) return true // nothing on the account to check
  if (partTokens.some((t) => resumeSet.has(t))) return true
  if (partTokens.length >= 2) {
    const joined = partTokens.join('')
    if (joined.length >= 4 && resumeJoined.includes(joined)) return true
  }
  return false
}

/**
 * Verify the resume belongs to the account holder. Requires the first name AND
 * the last name to each be present in the resume's name — order-independent and
 * tolerant of middle names, so a genuine student passes while a wholesale
 * different name (wrong file or someone else's resume) is caught.
 */
function nameMatchesProfile(p: ProfileNameParts, resumeName: string): boolean {
  const resumeTokens = nameTokens(resumeName)
  if (resumeTokens.length === 0) return true // no readable name — can't verify
  const resumeSet = new Set(resumeTokens)
  const resumeJoined = resumeTokens.join('')

  const firstTokens = nameTokens(p.first_name ?? '')
  const lastTokens = nameTokens(p.last_name ?? '')
  if (firstTokens.length === 0 && lastTokens.length === 0) return true // no name on file

  return (
    partPresent(firstTokens, resumeSet, resumeJoined) &&
    partPresent(lastTokens, resumeSet, resumeJoined)
  )
}

function dedupe(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const seen = new Map<string, string>()
  for (const v of values) {
    if (typeof v !== 'string') continue
    const t = v.trim()
    if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t)
  }
  return [...seen.values()]
}
