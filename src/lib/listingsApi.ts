import { supabase } from './supabase'
import type { Application, ApplicationStatus, Internship, PreEmploymentRequirement } from './mockData'

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

/** Skills-overlap match %: how many of the listing's skills the student has. */
export function computeMatch(profileSkills: string[], listingSkills: string[]): number {
  if (!listingSkills.length) return 0
  const mine = new Set(profileSkills.map((s) => s.trim().toLowerCase()))
  const hit = listingSkills.filter((s) => mine.has(s.trim().toLowerCase())).length
  return Math.round((hit / listingSkills.length) * 100)
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
  const path = `${studentId}/requirements/${applicationId}-${requirementId}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (uploadError) throw new Error(uploadError.message)
  await upsertSubmission(applicationId, requirementId, { file_path: path })
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
