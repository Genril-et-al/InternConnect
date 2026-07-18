import { supabase } from './supabase'
import type { Application, ApplicationStatus, Internship, PreEmploymentRequirement } from './mockData'

const RELATED_SKILL_GROUPS = [
  [
    'embedded systems',
    'embedded software',
    'embedded c',
    'firmware',
    'firmware development',
    'microcontroller',
    'arm cortex-m',
    'arm',
    'rtos',
    'uart',
    'spi',
    'i2c',
    'esp32',
    'arduino',
    'raspberry pi',
    'c/c++',
    'c++',
  ],
  [
    'pcb design',
    'printed circuit board',
    'electronics design',
    'kicad',
    'altium designer',
    'schematic capture',
    'dfm',
    'soldering',
    'electrical schematics',
  ],
  [
    'robotics',
    'robotics software',
    'ros',
    'computer vision',
    'opencv',
    'automation',
    'control systems',
  ],
  ['iot', 'internet of things', 'mqtt', 'aws iot', 'esp32', 'node.js', 'embedded systems'],
  ['data analytics', 'data analysis', 'statistics', 'excel', 'root cause analysis'],
  ['machine learning', 'artificial intelligence', 'edge ai', 'tensorflow lite', 'model optimization'],
  ['networking', 'network engineering', 'ccna', 'tcp/ip', 'cisco ios', 'network security', 'wireshark'],
  ['rf engineering', 'telecommunications', 'rf fundamentals', 'spectrum analysis', 'lte/5g', 'matlab', 'site survey'],
  ['automation engineering', 'plc', 'ladder logic', 'scada', 'hmi', 'electrical schematics'],
  ['frontend development', 'frontend', 'react', 'typescript', 'javascript', 'html', 'css', 'ui/ux design', 'figma'],
  ['backend development', 'backend', 'node.js', 'api development', 'databases', 'sql'],
]

function normalizeSkill(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[._-]/g, ' ')
    .replace(/\s+/g, ' ')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function includesWholePhrase(value: string, phrase: string): boolean {
  return new RegExp(`(^|\\W)${escapeRegExp(phrase)}(\\W|$)`).test(value)
}

function tokens(value: string): string[] {
  return value.match(/[a-z0-9+#]+/g) ?? []
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function tokenOverlapScore(a: string, b: string): number {
  const aTokens = new Set(tokens(a))
  const bTokens = tokens(b)
  if (!aTokens.size || !bTokens.length) return 0
  const shared = bTokens.filter((token) => aTokens.has(token)).length
  return shared / Math.max(aTokens.size, bTokens.length)
}

function phraseSpecificity(value: string): number {
  return Math.min(tokens(value).length / 4, 1)
}

function relatedSkillScore(profileSkill: string, listingSkill: string): number {
  let best = 0
  for (const group of RELATED_SKILL_GROUPS) {
    const profileTerms = group
      .map(normalizeSkill)
      .filter((term) => includesWholePhrase(profileSkill, term))
    if (!profileTerms.length) continue

    const listingTerms = group
      .map(normalizeSkill)
      .filter((term) => includesWholePhrase(listingSkill, term))
    if (!listingTerms.length) continue

    for (const profileTerm of profileTerms) {
      for (const listingTerm of listingTerms) {
        const score =
          0.45 +
          phraseSpecificity(profileTerm) * 0.16 +
          phraseSpecificity(listingTerm) * 0.16 +
          tokenOverlapScore(profileTerm, listingTerm) * 0.18
        best = Math.max(best, clampScore(score))
      }
    }
  }
  return best
}

function skillCoverageScore(profileSkills: string[], listingSkill: string): number {
  const skill = normalizeSkill(listingSkill)
  if (!skill) return 0
  if (profileSkills.some((mine) => mine === skill)) return 1
  if (
    profileSkills.some(
      (mine) => (mine.length > 3 && skill.includes(mine)) || (skill.length > 3 && mine.includes(skill)),
    )
  ) {
    return 0.95
  }
  return profileSkills.reduce((best, mine) => Math.max(best, relatedSkillScore(mine, skill)), 0)
}

/**
 * Student-side data layer for internship listings, applications, and
 * bookmarks (UC-S03..S05). Reads/writes go through RLS: students only see
 * open listings and their own applications/bookmarks.
 */

const STATUS_LABELS: Record<string, ApplicationStatus> = {
  pending: 'Pending',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview scheduled',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

const SETUP_LABELS: Record<string, Internship['setup']> = {
  onsite: 'Onsite',
  remote: 'Remote',
  hybrid: 'Hybrid',
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Skills-overlap match %: how many of the listing's skills the student covers.
 * The student pool is everything on their profile — AI-extracted resume skills
 * plus any manually added skills AND specializations — so profile-only entries
 * count toward the match too. Specializations also match loosely (a "Frontend
 * Development" specialization covers a "Frontend" listing skill and vice versa).
 * Close domain relationships receive variable partial credit based on confidence.
 */
export function computeMatch(studentPool: string[], listingSkills: string[]): number {
  if (!listingSkills.length) return 0
  const mine = studentPool.map(normalizeSkill).filter(Boolean)
  const covered = listingSkills.reduce((sum, skill) => sum + skillCoverageScore(mine, skill), 0)
  return Math.round((covered / listingSkills.length) * 100)
}

/** The full matching pool for a student profile: skills + specializations. */
export function matchPool(skills?: string[] | null, specializations?: string[] | null): string[] {
  return [...(skills ?? []), ...(specializations ?? [])]
}

function listingStatus(deadline: string | null): Internship['status'] {
  if (!deadline) return 'Open'
  const due = new Date(deadline)
  const now = new Date()
  if (due.getTime() < now.setHours(0, 0, 0, 0)) return 'Closed'
  const soon = new Date()
  soon.setDate(soon.getDate() + 7)
  return due <= soon ? 'Closing soon' : 'Open'
}

type ListingRow = {
  id: string
  title: string
  description: string | null
  location: string | null
  setup: string
  duration_hours: number | null
  slots: number
  deadline: string | null
  skills: string[]
  companies: { name: string; industry: string | null } | null
}

/** Open listings, ranked by skills match against the student's profile. */
export async function fetchOpenListings(profileSkills: string[]): Promise<Internship[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, description, location, setup, duration_hours, slots, deadline, skills, companies(name, industry)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as ListingRow[])
    .map((r) => ({
      id: r.id,
      title: r.title,
      company: r.companies?.name ?? 'Unknown company',
      industry: r.companies?.industry ?? '—',
      location: r.location ?? '—',
      setup: SETUP_LABELS[r.setup] ?? 'Onsite',
      deadline: formatDate(r.deadline),
      duration: r.duration_hours ? `${r.duration_hours} hours` : '—',
      slots: r.slots,
      match: computeMatch(profileSkills, r.skills ?? []),
      status: listingStatus(r.deadline),
      skills: r.skills ?? [],
      summary: r.description ?? '',
    }))
    .sort((a, b) => b.match - a.match)
}

type ApplicationRow = {
  id: string
  listing_id: string
  status: string
  next_step: string | null
  cover_letter: string | null
  created_at: string
  listings: {
    title: string
    companies: { name: string } | null
    listing_requirements: { id: string; name: string; kind: string; is_printable: boolean }[]
  } | null
  requirement_submissions: { requirement_id: string; status: string; text_value: string | null }[]
}

/** The signed-in student's applications, newest first. */
export async function fetchMyApplications(studentId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(
      'id, listing_id, status, next_step, cover_letter, created_at, ' +
        'listings(title, companies(name), listing_requirements(id, name, kind, is_printable)), ' +
        'requirement_submissions(requirement_id, status, text_value)',
    )
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as ApplicationRow[]).map((r) => {
    const reqs: PreEmploymentRequirement[] = (r.listings?.listing_requirements ?? []).map((q) => {
      const sub = (r.requirement_submissions ?? []).find((s) => s.requirement_id === q.id)
      return {
        id: q.id,
        name: q.name,
        type: q.kind === 'file' ? ('file' as const) : ('text' as const),
        isPrintable: q.is_printable,
        submissionStatus: !sub
          ? ('not_submitted' as const)
          : sub.status === 'approved'
            ? ('approved' as const)
            : sub.status === 'rejected'
              ? ('rejected' as const)
              : ('pending' as const),
        submittedText: sub?.text_value ?? undefined,
      }
    })
    const approved = (r.requirement_submissions ?? []).filter((s) => s.status === 'approved').length
    return {
      id: r.id,
      internshipId: r.listing_id,
      company: r.listings?.companies?.name ?? 'Unknown company',
      role: r.listings?.title ?? '—',
      dateApplied: formatDate(r.created_at),
      status: STATUS_LABELS[r.status] ?? 'Pending',
      nextStep: r.next_step ?? '',
      coverLetter: r.cover_letter ?? undefined,
      requirements: reqs,
      approvedRequirements: approved,
    }
  })
}

/** Submit an application to an open listing (UC-S04). */
export async function applyToListing(
  studentId: string,
  listingId: string,
  coverLetter: string,
): Promise<void> {
  const { error } = await supabase.from('applications').insert({
    listing_id: listingId,
    student_id: studentId,
    cover_letter: coverLetter.trim() || null,
  })
  if (error) {
    if (error.code === '23505') throw new Error('You have already applied to this internship.')
    throw new Error(error.message)
  }
}

/**
 * Submit (or resubmit) a pre-employment requirement. Files go to the private
 * documents bucket under the student's uid folder; the submission row is
 * upserted back to 'pending' for company review. RLS blocks changing an
 * already-approved submission.
 */
export async function submitRequirementFile(
  studentId: string,
  applicationId: string,
  requirementId: string,
  file: File,
): Promise<void> {
  const parts = file.name.split('.')
  const ext = parts.length > 1 ? parts.pop()!.toLowerCase() : 'bin'

  // Unique per submission: resubmitting after "needs revision" used to write to
  // the same key, so the company kept seeing the rejected version from cache.
  const path = `${studentId}/requirements/${applicationId}-${requirementId}-${Date.now()}.${ext}`

  // The file this replaces, so it can be cleaned up after a successful upload.
  const { data: existing } = await supabase
    .from('requirement_submissions')
    .select('file_path')
    .eq('application_id', applicationId)
    .eq('requirement_id', requirementId)
    .maybeSingle()

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { contentType: file.type, cacheControl: '0' })
  if (uploadError) throw new Error(uploadError.message)

  await upsertSubmission(applicationId, requirementId, { file_path: path })

  const previous = existing?.file_path as string | undefined
  if (previous && previous !== path && previous.startsWith(`${studentId}/`)) {
    await supabase.storage.from('documents').remove([previous])
  }
}

export async function submitRequirementText(
  applicationId: string,
  requirementId: string,
  text: string,
): Promise<void> {
  await upsertSubmission(applicationId, requirementId, { text_value: text.trim() })
}

async function upsertSubmission(
  applicationId: string,
  requirementId: string,
  payload: { file_path?: string; text_value?: string },
): Promise<void> {
  const { error } = await supabase.from('requirement_submissions').upsert(
    {
      application_id: applicationId,
      requirement_id: requirementId,
      status: 'pending',
      submitted_at: new Date().toISOString(),
      ...payload,
    },
    { onConflict: 'application_id,requirement_id' },
  )
  if (error) {
    if (error.code === '42501')
      throw new Error('This requirement was already approved and can no longer be changed.')
    throw new Error(error.message)
  }
}

/** The student's bookmarked listing ids (UC-S03). */
export async function fetchBookmarks(studentId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('listing_id')
    .eq('student_id', studentId)
  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((r) => r.listing_id as string))
}

export async function setBookmarked(
  studentId: string,
  listingId: string,
  bookmarked: boolean,
): Promise<void> {
  if (bookmarked) {
    const { error } = await supabase
      .from('bookmarks')
      .upsert({ student_id: studentId, listing_id: listingId })
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('student_id', studentId)
      .eq('listing_id', listingId)
    if (error) throw new Error(error.message)
  }
}
