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
  expired: 'Expired',
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

export function formatTimeAgo(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  
  return formatDate(iso)
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
  has_allowance: boolean
  companies: { id: string; name: string; industry: string | null; logo_url: string | null } | null
}

function toInternship(row: ListingRow, profileSkills: string[]): Internship {
  return {
    id: row.id,
    title: row.title,
    companyId: row.companies?.id,
    company: row.companies?.name ?? 'Unknown company',
    companyLogo: row.companies?.logo_url ?? null,
    industry: row.companies?.industry ?? '—',
    location: row.location ?? '—',
    setup: SETUP_LABELS[row.setup] ?? 'Onsite',
    deadline: formatDate(row.deadline),
    duration: row.duration_hours ? `${row.duration_hours} hours` : '—',
    slots: row.slots,
    match: computeMatch(profileSkills, row.skills ?? []),
    status: listingStatus(row.deadline),
    skills: row.skills ?? [],
    summary: row.description ?? '',
    hasAllowance: row.has_allowance,
  }
}

/** Unscored listings (nothing to match on) sort last rather than as 0%. */
function rankedByMatch(listings: Internship[]): Internship[] {
  return [...listings].sort((a, b) => (b.match ?? -1) - (a.match ?? -1))
}

/**
 * How many listings we pull per round trip.
 *
 * Note this is NOT UI paging. The board ranks by match score, and match is
 * computed here on the client from the skill taxonomy — the database has no
 * idea what a given student's match % is. So it cannot hand us "the best 20";
 * page 1 by created_at says nothing about who ranks highest. Search and the
 * match-filter pills are client-side over the full set for the same reason.
 *
 * Fetching in chunks instead of one giant response means the student sees a
 * usable, ranked board after the first chunk rather than waiting on the whole
 * table, and no single response has to be held in memory at once.
 */
const LISTINGS_PAGE_SIZE = 200

/**
 * Open listings, ranked by skills match against the student's profile.
 *
 * `onPartial` (optional) is called with the ranked listings so far after each
 * chunk beyond the first, so callers can paint early and let the rest fill in.
 * The resolved value is always the complete, fully ranked set.
 */
export async function fetchOpenListings(
  profileSkills: string[],
  onPartial?: (listings: Internship[]) => void,
): Promise<Internship[]> {
  const all: Internship[] = []

  for (let from = 0; ; from += LISTINGS_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, description, location, setup, duration_hours, slots, deadline, skills, has_allowance, companies(id, name, industry, logo_url)')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      // id breaks ties so the window is stable: listings sharing a created_at
      // could otherwise land in two chunks, or none, as we page through.
      .order('id', { ascending: true })
      .range(from, from + LISTINGS_PAGE_SIZE - 1)
    if (error) throw new Error(error.message)

    const rows = (data ?? []) as unknown as ListingRow[]
    for (const row of rows) all.push(toInternship(row, profileSkills))

    if (rows.length < LISTINGS_PAGE_SIZE) break
    onPartial?.(rankedByMatch(all))
  }

  return rankedByMatch(all)
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
    companies: { id: string; owner_id: string; name: string; logo_url: string | null } | null
    listing_requirements: { id: string; name: string; kind: string; is_printable: boolean; description: string | null; template_file_url: string | null }[]
  } | null
  requirement_submissions: { requirement_id: string; status: string; text_value: string | null; file_path: string | null }[]
}

/** The signed-in student's applications, newest first. */
export async function fetchMyApplications(studentId: string): Promise<Application[]> {
  let data: any[] | null = null
  let error: any = null

  const response = await supabase
    .from('applications')
    .select(
      'id, listing_id, status, next_step, feedback, created_at, ' +
        'listings(title, companies(id, owner_id, name, logo_url), listing_requirements(id, name, kind, is_printable, description, template_file_url)), ' +
        'requirement_submissions(requirement_id, status, text_value, file_path)',
    )
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (response.error && (response.error.message.includes('template_file_url') || response.error.code === '42703')) {
    const fallbackResponse = await supabase
      .from('applications')
      .select(
        'id, listing_id, status, next_step, feedback, created_at, ' +
          'listings(title, companies(id, owner_id, name, logo_url), listing_requirements(id, name, kind, is_printable)), ' +
          'requirement_submissions(requirement_id, status, text_value, file_path)',
      )
      .eq('student_id', studentId)
      .order('created_at', { ascending: false })
    data = fallbackResponse.data
    error = fallbackResponse.error
  } else {
    data = response.data
    error = response.error
  }

  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as ApplicationRow[]).map((r) => {
    let parsedFeedback: Record<string, string> = {}
    let generalFeedback: string | undefined = undefined
    if (r.feedback) {
      try {
        parsedFeedback = JSON.parse(r.feedback)
      } catch {
        // Not a JSON object — a legacy plain-text rejection reason. Leave the
        // per-requirement map empty.
        generalFeedback = r.feedback
      }
    }

    const reqs: PreEmploymentRequirement[] = (r.listings?.listing_requirements ?? []).map((q) => {
      const sub = (r.requirement_submissions ?? []).find((s) => s.requirement_id === q.id)
      return {
        id: q.id,
        name: q.name,
        type: q.kind === 'file' ? ('file' as const) : ('text' as const),
        isPrintable: q.is_printable,
        description: q.description ?? undefined,
        templateFileUrl: q.template_file_url ?? null,
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
      companyId: r.listings?.companies?.id ?? '',
      companyOwnerId: r.listings?.companies?.owner_id ?? '',
      companyLogo: r.listings?.companies?.logo_url ?? null,
      role: r.listings?.title ?? 'Unknown role',
      dateApplied: formatDate(r.created_at),
      status: STATUS_LABELS[r.status] ?? 'Pending',
      nextStep: r.next_step ?? '',
      feedback: generalFeedback,
      requirements: reqs,
      approvedRequirements: approved,
    }
  })
}

/** Submit an application to an open listing (UC-S04). */
export async function applyToListing(
  studentId: string,
  listingId: string,
  coverLetterFile: File,
): Promise<void> {
  // Upload cover letter to a deterministic path so we don't need a DB column
  const path = `${studentId}/applications/${listingId}_cover_letter.pdf`
  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(path, coverLetterFile, { upsert: true })
  
  if (uploadError) {
    throw new Error(`Failed to upload cover letter: ${uploadError.message}`)
  }

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
    .select('listing_id')
    .single()
  
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

  const { data: appData } = await supabase.from('applications').select('listing_id').eq('id', applicationId).single()
  if (appData) {
    await supabase.rpc('check_and_close_listing', { p_listing_id: appData.listing_id })
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
    .select('id, previous_status, listing_id')
    .eq('student_id', studentId)
    .eq('status', 'discarded')

  if (fetchError) throw new Error(fetchError.message)

  const listingIds = Array.from(new Set((discardedApps || []).map((a) => a.listing_id)))
  const closedListingIds = new Set<string>()

  if (listingIds.length > 0) {
    const { data: listings } = await supabase
      .from('listings')
      .select('id, status')
      .in('id', listingIds)
    
    for (const listing of listings || []) {
      if (listing.status === 'closed') {
        closedListingIds.add(listing.id)
      }
    }
  }

  // Restore each to its previous status or set to expired if listing is closed
  for (const app of discardedApps || []) {
    if (app.previous_status) {
      const isClosed = closedListingIds.has(app.listing_id)
      const targetStatus = isClosed ? 'expired' : app.previous_status
      const { error: restoreError } = await supabase
        .from('applications')
        .update({ status: targetStatus, previous_status: null })
        .eq('id', app.id)
        
      if (restoreError) throw new Error(restoreError.message)
    }
  }
}

export async function updateInterviewResponse(applicationId: string, responseJson: string) {
  const { error } = await supabase.from('applications').update({ next_step: responseJson }).eq('id', applicationId)
  if (error) throw new Error(error.message)
}

export type StudentCompany = {
  id: string
  name: string
  logo_url: string | null
  industry: string
  location: string
  description: string
  website: string
  contact_email: string
  contact_phone: string
}

export async function fetchAllCompanies(): Promise<StudentCompany[]> {
  let { data, error } = await supabase
    .from('companies')
    .select('id, name, logo_url, industry, location, description, website, contact_email, contact_phone')
    .order('name', { ascending: true })

  if (error) {
    console.warn("Failed to fetch with contact details. Migration might be missing. Falling back...", error);
    const fallback = await supabase
      .from('companies')
      .select('id, name, logo_url, industry, location, description, website')
      .order('name', { ascending: true })
    if (fallback.data) {
      data = fallback.data.map(r => ({ ...r, contact_email: null, contact_phone: null })) as any
    }
    error = fallback.error
  }

  if (error) throw new Error(error.message)
  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    logo_url: row.logo_url,
    industry: row.industry || '—',
    location: row.location || '—',
    description: row.description || 'No description provided.',
    website: row.website || '',
    contact_email: row.contact_email || '',
    contact_phone: row.contact_phone || ''
  }))
}

