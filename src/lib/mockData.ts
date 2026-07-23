/**
 * Shared student-portal view models. Data now loads live from Supabase
 * (see listingsApi.ts) — these types are the UI-facing shapes the
 * components render.
 */

export type ApplicationStatus =
  | 'Pending'
  | 'Under review'
  | 'Shortlisted'
  | 'Interview scheduled'
  | 'Offered'
  | 'Accepted'
  | 'Rejected'
  | 'Discarded'
  | 'Withdrawn'
  | 'Expired'

export type Internship = {
  id: string
  title: string
  companyId?: string
  company: string
  companyLogo?: string | null
  industry: string
  location: string
  setup: 'Onsite' | 'Remote' | 'Hybrid'
  deadline: string
  duration: string
  slots: number
  /** null when there is no skill data to score against — render as "—". */
  match: number | null
  status: 'Open' | 'Closing soon' | 'Closed'
  skills: string[]
  summary: string
  hasAllowance?: boolean
}

export type SubmissionStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected'

export type PreEmploymentRequirement = {
  id: string
  name: string
  type: 'file' | 'text'
  description?: string
  isPrintable: boolean
  templateFileUrl?: string | null
  /** Review state of the student's submission for this requirement. */
  submissionStatus?: 'pending' | 'approved' | 'rejected' | 'not_submitted'
  submittedText?: string
  submittedFilePath?: string
  feedback?: string
}

export type Application = {
  id: string
  internshipId: string
  company: string
  companyId: string
  companyOwnerId: string
  companyLogo?: string | null
  role: string
  dateApplied: string
  status: ApplicationStatus
  nextStep: string
  feedback?: string
  requirements?: PreEmploymentRequirement[]
  approvedRequirements?: number
  /**
   * Whether the listing has an interview stage. Companies can post a listing
   * with "no interview", in which case the Interview step is hidden from the
   * student's progress bar. Defaults to true when unknown.
   */
  hasInterview?: boolean
}
