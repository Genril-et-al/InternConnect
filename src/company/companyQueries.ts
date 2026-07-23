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
  interview_scheduled: 'Interview',
  offered: 'Offer',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

const APPLICANT_STATUS_TO_DB: Record<ApplicantStatus, string> = {
  Pending: 'pending',
  Reviewed: 'under_review',
  Interview: 'interview_scheduled',
  Offer: 'offered',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Withdrawn: 'withdrawn',
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

export type CompanyProfile = {
  id: string
  name: string
  industry: string | null
  location: string | null
  website: string | null
  description: string | null
  logo_url: string | null
  contact_email: string | null
  contact_phone: string | null
}

export async function fetchCompanyProfile(): Promise<CompanyProfile | null> {
  let { data, error } = await supabase
    .from('companies')
    .select('id, name, industry, location, website, description, logo_url, contact_email, contact_phone')
    .eq('owner_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .maybeSingle()

  if (error) {
    console.warn('Failed to fetch contact details. Falling back...', error)
    const fallback = await supabase
      .from('companies')
      .select('id, name, industry, location, website, description, logo_url')
      .eq('owner_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .maybeSingle()
    if (fallback.data) {
      data = { ...fallback.data, contact_email: null, contact_phone: null } as any
    }
    error = fallback.error
  }

  if (error) throw new Error(error.message)
  return data as CompanyProfile | null
}

export async function updateCompanyProfile(id: string, updates: Partial<CompanyProfile>): Promise<void> {
  let { error } = await supabase
    .from('companies')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.warn('Update with contact details failed. Falling back...', error)
    const { contact_email, contact_phone, ...baseUpdates } = updates
    const fallback = await supabase
      .from('companies')
      .update(baseUpdates)
      .eq('id', id)
    error = fallback.error
  }

  if (error) throw new Error(error.message)
}




export async function fetchCompanyListings(companyId: string): Promise<CompanyListing[]> {
  let data: any[] | null = null
  let error: any = null

  const response = await supabase
    .from('listings')
    .select('id, title, status, slots, deadline, department, skills, description, has_allowance, interview_process, listing_requirements(id, name, kind, is_printable, description, template_file_url)')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })

  if (response.error && (response.error.message.includes('template_file_url') || response.error.code === '42703')) {
    const fallbackResponse = await supabase
      .from('listings')
      .select('id, title, status, slots, deadline, department, skills, description, has_allowance, interview_process, listing_requirements(id, name, kind, is_printable)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
    data = fallbackResponse.data
    error = fallbackResponse.error
  } else {
    data = response.data
    error = response.error
  }

  if (error) throw new Error(error.message)
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id,
    title: r.title,
    status: LISTING_STATUS_FROM_DB[r.status] ?? 'Draft',
    slots: r.slots,
    deadline: formatDate(r.deadline),
    department: r.department ?? '—',
    skills: r.skills ?? [],
    description: r.description ?? '',
    requirements: (r.listing_requirements ?? []).map((q: any) => ({
      id: q.id,
      name: q.name,
      type: q.kind === 'file' ? ('file' as const) : ('text' as const),
      isPrintable: q.is_printable,
      description: q.description ?? undefined,
      templateFileUrl: q.template_file_url ?? null,
    })),
    interviewProcess: r.interview_process as { rounds: string[] } | undefined,
    hasAllowance: r.has_allowance,
  }))
}

export type NewListingInput = {
  title: string
  department: string
  slots: number
  deadline: string // yyyy-mm-dd or ''
  skills: string[]
  description: string
  hasAllowance: boolean
  offerDeadlineDays: number
  publish: boolean
  requirements: Omit<PreEmploymentRequirement, 'id'>[]
  interviewProcess: { rounds: string[] }
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
      interview_process: input.interviewProcess,
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '42501')
      throw new Error('Your company must be verified by the NLO before posting listings.')
    throw new Error(error.message)
  }
  if (input.requirements.length) {
    const { error: reqErr } = await supabase.from('listing_requirements').insert(
      input.requirements.map((r) => ({
        listing_id: data.id,
        name: r.name,
        kind: r.type,
        is_printable: r.isPrintable,
        description: r.description || null,
        template_file_url: r.templateFileUrl || null,
      })),
    )
    if (reqErr) throw new Error(reqErr.message)
  }
}

export async function updateListing(listingId: string, input: NewListingInput): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({
      title: input.title,
      department: input.department || null,
      slots: input.slots,
      deadline: input.deadline || null,
      skills: input.skills,
      description: input.description,
      status: input.publish ? 'open' : 'draft',
      interview_process: input.interviewProcess,
    })
    .eq('id', listingId)
  if (error) throw new Error(error.message)

  await supabase.from('listing_requirements').delete().eq('listing_id', listingId)
  if (input.requirements.length) {
    const { error: reqError } = await supabase.from('listing_requirements').insert(
      input.requirements.map((r) => ({
        listing_id: listingId,
        name: r.name,
        kind: r.type,
        is_printable: r.isPrintable,
        description: r.description || null,
        template_file_url: r.templateFileUrl || null,
      })),
    )
    if (reqError) throw new Error(reqError.message)
  }
}

export async function setListingStatus(
  listingId: string,
  status: CompanyListing['status'],
): Promise<void> {
  const dbStatus = LISTING_STATUS_TO_DB[status]
  const { error } = await supabase
    .from('listings')
    .update({ status: dbStatus })
    .eq('id', listingId)
  if (error) throw new Error(error.message)

  if (dbStatus === 'closed') {
    const { error: appError } = await supabase
      .from('applications')
      .update({ 
        status: 'rejected',
        feedback: 'Hiring completed – All available internship positions have been filled.'
      })
      .eq('listing_id', listingId)
      .in('status', ['pending', 'under_review', 'shortlisted', 'interview_scheduled', 'offered'])
    if (appError) throw new Error(appError.message)
  }
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
  portfolio_link: string | null
  portfolio_file_url: string | null
  photo_url: string | null
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
    listing_requirements: { id: string; name: string; is_printable: boolean; description: string | null; template_file_url: string | null }[]
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
  let data: any[] | null = null
  let error: any = null

  const response = await supabase
    .from('applications')
    .select(
      'id, listing_id, student_id, status, feedback, next_step, created_at, ' +
        'listings!inner(title, skills, company_id, listing_requirements(id, name, is_printable, description, template_file_url)), ' +
        'requirement_submissions(id, requirement_id, status, file_path, text_value)',
    )
    .eq('listings.company_id', companyId)
    .order('created_at', { ascending: false })

  if (response.error && (response.error.message.includes('template_file_url') || response.error.code === '42703')) {
    const fallbackResponse = await supabase
      .from('applications')
      .select(
        'id, listing_id, student_id, status, feedback, next_step, created_at, ' +
          'listings!inner(title, skills, company_id, listing_requirements(id, name, is_printable)), ' +
          'requirement_submissions(id, requirement_id, status, file_path, text_value)',
      )
      .eq('listings.company_id', companyId)
      .order('created_at', { ascending: false })
    data = fallbackResponse.data
    error = fallbackResponse.error
  } else {
    data = response.data
    error = response.error
  }

  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as ApplicantRow[]

  // Applicant details come from the applicant_profiles view rather than an
  // embedded profiles join: profiles rows carry address, age, gender,
  // personal_email and contact_number, and RLS cannot withhold columns, so
  // embedding profiles handed all of it to the company (migration 0012).
  const studentIds = [...new Set(rows.map((r) => r.student_id))]
  const profileById = new Map<string, ApplicantProfile>()
  if (studentIds.length > 0) {
    let profilesData: ApplicantProfile[] = []
    const { data: profiles, error: profilesError } = await supabase
      .from('applicant_profiles')
      .select('id, full_name, email, skills, specializations, resume_url, portfolio_link, portfolio_file_url, photo_url')
      .in('id', studentIds)
      
    if (profilesError) {
      if (profilesError.message.includes('photo_url') || profilesError.code === '42703') {
        const { data: fallbackProfiles, error: fallbackError } = await supabase
          .from('applicant_profiles')
          .select('id, full_name, email, skills, specializations, resume_url, portfolio_link, portfolio_file_url')
          .in('id', studentIds)
        if (fallbackError) throw new Error(fallbackError.message)
        profilesData = (fallbackProfiles ?? []).map(p => ({ ...p, photo_url: null })) as ApplicantProfile[]
      } else {
        throw new Error(profilesError.message)
      }
    } else {
      profilesData = (profiles ?? []) as ApplicantProfile[]
    }
    
    for (const p of profilesData) profileById.set(p.id, p)
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
        isPrintable: q.is_printable,
        description: q.description ?? undefined,
        templateFileUrl: q.template_file_url ?? null,
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
      // Cover letters are uploaded on a per-application basis using deterministic paths.
      // We fall back to the profile cover letter for legacy applications.
      coverLetterFile: `${r.student_id}/applications/${r.listing_id}_cover_letter.pdf`,
      feedback: r.feedback ?? undefined,
      nextStep: r.next_step ?? undefined,
      submittedRequirements: submitted,
      photoUrl: profile?.photo_url ?? null,
    }
  })
}

/** Accept / reject / mark-reviewed an application (UC-C05). */
export async function updateApplicationStatus(id: string, status: ApplicantStatus, feedback?: string, nextStep?: string): Promise<void> {
  const payload: any = { status: APPLICANT_STATUS_TO_DB[status] }
  if (feedback !== undefined) payload.feedback = feedback
  if (nextStep !== undefined) payload.next_step = nextStep
  const { error } = await supabase
    .from('applications')
    .update(payload)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function bulkRejectApplications(
  rejections: { id: string; feedback: string }[]
): Promise<void> {
  const promises = rejections.map((r) =>
    supabase
      .from('applications')
      .update({ status: 'rejected', feedback: r.feedback })
      .eq('id', r.id)
  )
  const results = await Promise.all(promises)
  for (const res of results) {
    if (res.error) throw new Error(res.error.message)
  }
}

/**
 * What the company fills in when scheduling an interview. Stored as JSON on
 * the application's next_step, so the shape is the contract with the student
 * side that renders it.
 */
export type InterviewDetails = {
  roundName?: string
  date: string
  time: string
  mode: 'online' | 'in-person'
  /** A meeting URL when online, a street address when in-person. */
  locationOrLink: string
  studentResponse?: 'accepted' | 'reschedule_requested'
  rescheduleReason?: string
  proposedDates?: { date: string; time: string }[]
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

export async function proposeInterviewDates(
  applicationId: string,
  interviewDetails: InterviewDetails,
): Promise<void> {
  const payload = {
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

  if (approve) {
    const { data: appData } = await supabase
      .from('applications')
      .select('listing_id')
      .eq('id', applicationId)
      .single()
    if (appData) {
      await checkAndCloseHiring(appData.listing_id)
    }
  }
}

export async function checkAndCloseHiring(listingId: string): Promise<void> {
  const { data: listing } = await supabase.from('listings').select('slots').eq('id', listingId).single()
  if (!listing) return

  const { count } = await supabase
    .from('applications')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', listingId)
    .eq('status', 'accepted')

  if (count !== null && count >= listing.slots) {
    await supabase.from('listings').update({ status: 'closed' }).eq('id', listingId)
    await supabase.from('applications').update({ status: 'expired' }).eq('listing_id', listingId).in('status', ['pending', 'under_review', 'shortlisted', 'interview_scheduled'])
  }
}
