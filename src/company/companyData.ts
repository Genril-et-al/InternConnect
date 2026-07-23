/**
 * Company portal view models. Data now loads live from Supabase
 * (see companyQueries.ts) — these are the UI-facing shapes.
 */

export type PreEmploymentRequirement = {
  id: string
  name: string
  type: 'file' | 'text'
  /** Free-text instruction shown to the student alongside the requirement. */
  description?: string
  isPrintable: boolean
}

export type CompanyListing = {
  id: string
  title: string
  status: 'Open' | 'Draft' | 'Closed'
  slots: number
  deadline: string
  department: string
  skills: string[]
  description: string
  requirements?: PreEmploymentRequirement[]
  interviewProcess?: { rounds: string[] }
  /** Days an offer stays open before it expires; falls back to 3 when unset. */
  offerDeadlineDays?: number
}

export type ApplicantStatus = 'Pending' | 'Reviewed' | 'Interview' | 'Offer' | 'Accepted' | 'Rejected'

/** A file the company sends to an accepted applicant (UC-C05 extension). */
export type RequirementFile = {
  name: string
  size: string
  note?: string
}

export type SubmittedRequirement = {
  id: string
  name: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Needs Revision' | 'Awaiting submission'
  /** Set once the student has submitted — required to review. */
  submissionId?: string
  fileUrl?: string
  /**
   * Why the submission was sent back, shown to the student on 'Needs Revision'.
   * Stored per-requirement in the applications.feedback JSON blob (keyed by
   * requirement id) rather than on requirement_submissions — see
   * companyQueries.buildApplicants.
   */
  feedback?: string
}

export type CompanyApplicant = {
  id: string
  name: string
  email: string
  listingId: string
  role: string
  /** null when the applicant has no skill data to score against. */
  match: number | null
  status: ApplicantStatus
  nextStep?: string
  applied: string
  skills: string[]
  specializations: string[]
  /** Storage path of the student's resume in the documents bucket. */
  resume: string
  portfolioLink?: string
  /** Storage path of the student's portfolio file. */
  portfolioFile?: string
  /** Storage path of the student's cover letter file, if they uploaded one. */
  coverLetterFile?: string
  /** Feedback sent to the applicant when rejected. */
  feedback?: string
  /** Additional requirement files sent when accepted (student can download). */
  requirements?: RequirementFile[]
  submittedRequirements?: SubmittedRequirement[]
}

export const MATCH_FILTERS: Record<string, number> = {
  'Any match %': 0,
  '60% +': 60,
  '70% +': 70,
  '80% +': 80,
  '90% +': 90,
}
