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

export type Internship = {
  id: string
  title: string
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
}

export type SubmissionStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected'

export type PreEmploymentRequirement = {
  id: string
  name: string
  type: 'file' | 'text'
  isPrintable: boolean
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
  companyLogo?: string | null
  role: string
  dateApplied: string
  status: ApplicationStatus
  nextStep: string
  requirements?: PreEmploymentRequirement[]
  approvedRequirements?: number
}
