import { supabase } from '../lib/supabase'
import { computeMatch, formatDate, matchPool } from '../lib/listingsApi'
import type {
  ApplicantStatus,
  CompanyApplicant,
  CompanyListing,
  PreEmploymentRequirement,
  SubmittedRequirement,
} from './companyData'

/**
 * Company-portal data layer (UC-C02..C05). All reads/writes are scoped by RLS
 * to the signed-in owner's company row.
 */

const LISTING_STATUS_TO_DB: Record<CompanyListing['status'], string> = {
  Open: 'open',
  Draft: 'draft',
  Closed: 'closed',
}

const LISTING_STATUS_FROM_DB: Record<string, CompanyListing['status']> = {
  open: 'Open',
  draft: 'Draft',
  closed: 'Closed',
}

const APPLICANT_STATUS_FROM_DB: Record<string, ApplicantStatus> = {
  pending: 'Pending',
  under_review: 'Reviewed',
  shortlisted: 'Reviewed',
  interview_scheduled: 'Interview Scheduled',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

const APPLICANT_STATUS_TO_DB: Record<ApplicantStatus, string> = {
  Pending: 'pending',
  Reviewed: 'under_review',
  'Interview Scheduled': 'interview_scheduled',
  Accepted: 'accepted',
  Rejected: 'rejected',
}

/** The company row owned by the signed-in user. */
export async function fetchMyCompany(): Promise<{
  id: string
  name: string
  verification: 'pending' | 'verified' | 'rejected'
} | null> {
  const { data, error } = await supabase
    .from('companies')
    .select('id, name, verification')
    .eq('owner_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as { id: string; name: string; verification: 'pending' | 'verified' | 'rejected' } | null
}

type CompanyListingRow = {
  id: string
  title: string
  status: string
  slots: number
  deadline: string | null
  department: string | null
  skills: string[]
  description: string | null
  listing_requirements: { id: string; name: string; kind: string; is_printable: boolean }[]
}

export async function fetchCompanyListings(companyId: string): Promise<CompanyListing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, status, slots, deadline, department, skills, description, listing_requirements(id, name, kind, is_printable)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as CompanyListingRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    status: LISTING_STATUS_FROM_DB[r.status] ?? 'Draft',
    slots: r.slots,
    deadline: formatDate(r.deadline),
    department: r.department ?? '—',
    skills: r.skills ?? [],
    description: r.description ?? '',
    requirements: (r.listing_requirements ?? []).map((q) => ({
      id: q.id,
      name: q.name,
      type: q.kind === 'file' ? ('file' as const) : ('text' as const),
      isPrintable: q.is_printable,
    })),
  }))
}

export type NewListingInput = {
  title: string
  department: string
  slots: number
  deadline: string // yyyy-mm-dd or ''
  skills: string[]
  description: string
  publish: boolean
  requirements: Omit<PreEmploymentRequirement, 'id'>[]
}

export async function createListing(companyId: string, input: NewListingInput): Promise<void> {
  const { data, error } = await supabase
    .from('listings')
    .insert({
      company_id: companyId,
      title: input.title,
      department: input.department || null,
      slots: input.slots,
      deadline: input.deadline || null,
      skills: input.skills,
      description: input.description,
      status: input.publish ? 'open' : 'draft',
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '42501')
      throw new Error('Your company must be verified by the NLO before posting listings.')
    throw new Error(error.message)
  }
  if (input.requirements.length) {
    const { error: reqError } = await supabase.from('listing_requirements').insert(
      input.requirements.map((r) => ({
        listing_id: data.id,
        name: r.name,
        kind: r.type,
        is_printable: r.isPrintable,
      })),
    )
    if (reqError) throw new Error(reqError.message)
  }
}

export async function setListingStatus(
  listingId: string,
  status: CompanyListing['status'],
): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({ status: LISTING_STATUS_TO_DB[status] })
    .eq('id', listingId)
  if (error) throw new Error(error.message)
}

export async function deleteListing(listingId: string): Promise<void> {
  const { error } = await supabase.from('listings').delete().eq('id', listingId)
  if (error) throw new Error(error.message)
}

type ApplicantProfile = {
  id: string
  full_name: string | null
  email: string
  skills: string[]
  specializations: string[]
  resume_url: string | null
  cover_letter_url: string | null
  portfolio_link: string | null
  portfolio_file_url: string | null
}

type ApplicantRow = {
  id: string
  listing_id: string
  student_id: string
  status: string
  feedback: string | null
  next_step: string | null
  created_at: string
  listings: {
    title: string
    skills: string[]
    listing_requirements: { id: string; name: string }[]
  } | null
  requirement_submissions: {
    id: string
    requirement_id: string
    status: string
    file_path: string | null
    text_value: string | null
  }[]
}

export async function fetchApplicants(companyId: string): Promise<CompanyApplicant[]> {
  const { data, error } = await supabase
    .from('applications')
    .select(
      'id, listing_id, student_id, status, feedback, next_step, created_at, ' +
        'listings!inner(title, skills, company_id, listing_requirements(id, name)), ' +
        'requirement_submissions(id, requirement_id, status, file_path, text_value)',
    )
    .eq('listings.company_id', companyId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as ApplicantRow[]

  // Applicant details come from the applicant_profiles view rather than an
  // embedded profiles join: profiles rows carry address, age, gender,
  // personal_email and contact_number, and RLS cannot withhold columns, so
  // embedding profiles handed all of it to the company (migration 0012).
  const studentIds = [...new Set(rows.map((r) => r.student_id))]
  const profileById = new Map<string, ApplicantProfile>()
  if (studentIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('applicant_profiles')
      .select('id, full_name, email, skills, specializations, resume_url, cover_letter_url, portfolio_link, portfolio_file_url')
      .in('id', studentIds)
    if (profilesError) throw new Error(profilesError.message)
    for (const p of (profiles ?? []) as ApplicantProfile[]) profileById.set(p.id, p)
  }

  return rows.map((r) => {
    const profile = profileById.get(r.student_id) ?? null
    let parsedFeedback: Record<string, string> = {}
    if (r.feedback) {
      try {
        parsedFeedback = JSON.parse(r.feedback)
      } catch {
        // Not a JSON object, ignore for requirement parsing
      }
    }
    const submitted: SubmittedRequirement[] = (r.listings?.listing_requirements ?? []).map((q) => {
      const sub = (r.requirement_submissions ?? []).find((s) => s.requirement_id === q.id)
      return {
        id: q.id,
        name: q.name,
        submissionId: sub?.id,
        status: !sub
          ? 'Awaiting submission'
          : sub.status === 'approved'
            ? 'Approved'
            : sub.status === 'rejected'
              ? 'Needs Revision'
              : 'Pending',
        fileUrl: sub?.file_path ?? undefined,
        feedback: sub?.status === 'rejected' ? (parsedFeedback[q.id] ?? undefined) : undefined,
      }
    })
    return {
      id: r.id,
      name: profile?.full_name || profile?.email || 'Unknown student',
      email: profile?.email ?? '—',
      listingId: r.listing_id,
      role: r.listings?.title ?? '—',
      match: computeMatch(
        matchPool(profile?.skills, profile?.specializations),
        r.listings?.skills ?? [],
      ),
      status: APPLICANT_STATUS_FROM_DB[r.status] ?? 'Pending',
      applied: formatDate(r.created_at),
      skills: profile?.skills ?? [],
      specializations: profile?.specializations ?? [],
      resume: profile?.resume_url ?? '',
      portfolioLink: profile?.portfolio_link ?? undefined,
      portfolioFile: profile?.portfolio_file_url ?? undefined,
      // Cover letters are files on the student's profile now, not typed text.
      coverLetterFile: profile?.cover_letter_url ?? undefined,
      feedback: r.feedback ?? undefined,
      nextStep: r.next_step ?? undefined,
      submittedRequirements: submitted,
    }
  })
}

/** Accept / reject / mark-reviewed an application (UC-C05). */
export async function updateApplicationStatus(
  applicationId: string,
  status: ApplicantStatus,
  feedback?: string,
): Promise<void> {
  // feedback is left off entirely when not supplied, rather than written as
  // null — an accept/reject with no note must not wipe an existing one.
  const payload: { status: string; feedback?: string } = {
    status: APPLICANT_STATUS_TO_DB[status],
  }
  if (feedback !== undefined) payload.feedback = feedback


  const { error } = await supabase.from('applications').update(payload).eq('id', applicationId)
  if (error) throw new Error(error.message)
}

/**
 * What the company fills in when scheduling an interview. Stored as JSON on
 * the application's next_step, so the shape is the contract with the student
 * side that renders it.
 */
export type InterviewDetails = {
  date: string
  time: string
  mode: 'online' | 'in-person'
  /** A meeting URL when online, a street address when in-person. */
  locationOrLink: string
}

export async function scheduleInterview(
  applicationId: string,
  interviewDetails: InterviewDetails,
): Promise<void> {
  const payload = {
    status: 'interview_scheduled',
    next_step: JSON.stringify(interviewDetails),
  }
  const { error } = await supabase.from('applications').update(payload).eq('id', applicationId)
  if (error) throw new Error(error.message)
}

/** Approve or send back a student's requirement submission. */
export async function reviewSubmission(
  submissionId: string,
  applicationId: string,
  approve: boolean,
  feedback?: string,
): Promise<void> {
  const { error } = await supabase
    .from('requirement_submissions')
    .update({ 
      status: approve ? 'approved' : 'rejected', 
      reviewed_at: new Date().toISOString() 
    })
    .eq('id', submissionId)
  if (error) throw new Error(error.message)

  if (feedback && !approve) {
    // We fetch the requirement_id and the current application feedback
    const { data: subData } = await supabase
      .from('requirement_submissions')
      .select('requirement_id')
      .eq('id', submissionId)
      .single()
      
    if (subData) {
      const { data: appData } = await supabase
        .from('applications')
        .select('feedback')
        .eq('id', applicationId)
        .single()
        
      let parsedFeedback: Record<string, string> = {}
      if (appData?.feedback) {
        try {
          parsedFeedback = JSON.parse(appData.feedback)
        } catch {
          // Legacy rows hold a plain rejection string, not the per-requirement
          // JSON map. Start fresh rather than losing the new feedback.
        }
      }
      
      parsedFeedback[subData.requirement_id] = feedback
      
      const { error: appErr } = await supabase
        .from('applications')
        .update({ feedback: JSON.stringify(parsedFeedback) })
        .eq('id', applicationId)
      if (appErr) throw new Error(appErr.message)
    }
  }
}
