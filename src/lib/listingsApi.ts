import { supabase } from './supabase'
import type { Application, ApplicationStatus, Internship, PreEmploymentRequirement } from './mockData'
import { computeMatch } from './skillMatch'

// The scorer lives in skillMatch.ts (no Supabase import, so it is testable from
// a plain script). Re-exported here so existing callers keep working.
export { computeMatch, matchPool, pairScore, skillGaps } from './skillMatch'



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
  offered: 'Offered',
  accepted: 'Accepted',
  rejected: 'Rejected',
  discarded: 'Discarded',
  withdrawn: 'Withdrawn',
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
  companies: { name: string; industry: string | null; logo_url: string | null } | null
}

/** Open listings, ranked by skills match against the student's profile. */
export async function fetchOpenListings(profileSkills: string[]): Promise<Internship[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, description, location, setup, duration_hours, slots, deadline, skills, companies(name, industry, logo_url)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as ListingRow[])
    .map((r) => ({
      id: r.id,
      title: r.title,
      company: r.companies?.name ?? 'Unknown company',
      companyLogo: r.companies?.logo_url ?? null,
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
    // Unscored listings (no skill data to match on) sort last rather than
    // being treated as 0%.
    .sort((a, b) => (b.match ?? -1) - (a.match ?? -1))
}

type ApplicationRow = {
  id: string
  listing_id: string
  status: string
  next_step: string | null
  feedback: string | null
  created_at: string
  listings: {
    title: string
    companies: { name: string; logo_url: string | null } | null
    listing_requirements: { id: string; name: string; kind: string; is_printable: boolean }[]
  } | null
  requirement_submissions: { requirement_id: string; status: string; text_value: string | null; file_path: string | null }[]
}

/** The signed-in student's applications, newest first. */
export async function fetchMyApplications(studentId: string): Promise<Application[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(
      'id, listing_id, status, next_step, feedback, created_at, ' +
        'listings(title, companies(name, logo_url), listing_requirements(id, name, kind, is_printable)), ' +
        'requirement_submissions(requirement_id, status, text_value, file_path)',
    )
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as ApplicationRow[]).map((r) => {
    let parsedFeedback: Record<string, string> = {}
    if (r.feedback) {
      try {
        parsedFeedback = JSON.parse(r.feedback)
      } catch {
        // Not a JSON object — a legacy plain-text rejection reason. Leave the
        // per-requirement map empty.
      }
    }

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
        submittedFilePath: sub?.file_path ?? undefined,
        feedback: sub?.status === 'rejected' ? (parsedFeedback[q.id] ?? undefined) : undefined,
      }
    })
    const approved = (r.requirement_submissions ?? []).filter((s) => s.status === 'approved').length
    return {
      id: r.id,
      internshipId: r.listing_id,
      company: r.listings?.companies?.name ?? 'Unknown company',
      companyLogo: r.listings?.companies?.logo_url ?? null,
      role: r.listings?.title ?? 'Unknown role',
      dateApplied: formatDate(r.created_at),
      status: STATUS_LABELS[r.status] ?? 'Pending',
      nextStep: r.next_step ?? '',
      requirements: reqs,
      approvedRequirements: approved,
    }
  })
}

/** Submit an application to an open listing (UC-S04). */
export async function applyToListing(
  studentId: string,
  listingId: string,
): Promise<void> {
  const { error } = await supabase.from('applications').insert({
    listing_id: listingId,
    student_id: studentId,
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

/** Reject an internship offer (UC-S04). */
export async function rejectOffer(applicationId: string) {
  const { error } = await supabase
    .from('applications')
    .update({ status: 'rejected' })
    .eq('id', applicationId)
  if (error) throw new Error(error.message)
}

/** Accept an internship offer (UC-S04). All other pending applications will be discarded. */
export async function acceptOffer(studentId: string, applicationId: string) {
  // Update the accepted application
  const { error: acceptError } = await supabase
    .from('applications')
    .update({ status: 'accepted' })
    .eq('id', applicationId)
  
  if (acceptError) throw new Error(acceptError.message)

  // Discard all other applications for this student that are not accepted, rejected, or already discarded
  // We need to fetch them first to save their previous status
  const { data: appsToDiscard, error: fetchError } = await supabase
    .from('applications')
    .select('id, status')
    .eq('student_id', studentId)
    .neq('id', applicationId)
    .neq('status', 'accepted')
    .neq('status', 'rejected')
    .neq('status', 'discarded')
    .neq('status', 'withdrawn')

  if (fetchError) throw new Error(fetchError.message)

  for (const app of appsToDiscard || []) {
    const { error: discardError } = await supabase
      .from('applications')
      .update({ status: 'discarded', previous_status: app.status })
      .eq('id', app.id)
      
    if (discardError) throw new Error(discardError.message)
  }
}

/** Withdraw acceptance from an internship offer. Restores discarded applications. */
export async function withdrawAcceptance(studentId: string, applicationId: string) {
  // Update the withdrawn application
  const { error: withdrawError } = await supabase
    .from('applications')
    .update({ status: 'withdrawn' })
    .eq('id', applicationId)
  
  if (withdrawError) throw new Error(withdrawError.message)

  // Find discarded applications to restore
  const { data: discardedApps, error: fetchError } = await supabase
    .from('applications')
    .select('id, previous_status')
    .eq('student_id', studentId)
    .eq('status', 'discarded')

  if (fetchError) throw new Error(fetchError.message)

  // Restore each to its previous status
  for (const app of discardedApps || []) {
    if (app.previous_status) {
      const { error: restoreError } = await supabase
        .from('applications')
        .update({ status: app.previous_status, previous_status: null })
        .eq('id', app.id)
        
      if (restoreError) throw new Error(restoreError.message)
    }
  }
}
