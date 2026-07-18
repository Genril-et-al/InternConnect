/**
 * Company portal seed data — replaced by Supabase tables (listings,
 * applications, storage files) in a later slice.
 */

export type PreEmploymentRequirement = {
  id: string
  name: string
  type: 'file' | 'text'
  isPrintable: boolean
}

export type CompanyListing = {
  id: number
  title: string
  status: 'Open' | 'Draft' | 'Closed'
  slots: number
  deadline: string
  department: string
  skills: string[]
  description: string
  requirements?: PreEmploymentRequirement[]
}

export type ApplicantStatus = 'Pending' | 'Reviewed' | 'Accepted' | 'Rejected'

/** A file the company sends to an accepted applicant (UC-C05 extension). */
export type RequirementFile = {
  name: string
  size: string
  note?: string
}

export type SubmittedRequirement = {
  id: string
  name: string
  status: 'Pending' | 'Approved' | 'Rejected' | 'Needs Revision'
  fileUrl?: string
}

export type CompanyApplicant = {
  id: number
  name: string
  email: string
  listingId: number
  role: string
  match: number
  status: ApplicantStatus
  applied: string
  skills: string[]
  specializations: string[]
  resume: string
  portfolioLink?: string
  portfolioFile?: string
  coverLetter: string
  /** Feedback sent to the applicant when rejected. */
  feedback?: string
  /** Additional requirement files sent when accepted (student can download). */
  requirements?: RequirementFile[]
  submittedRequirements?: SubmittedRequirement[]
}

// Seed listings removed — the portal starts empty and fills from real company
// actions (and the Supabase listings table once that slice lands).
export const SEED_COMPANY_LISTINGS: CompanyListing[] = []

export const MATCH_FILTERS: Record<string, number> = {
  'Any match %': 0,
  '60% +': 60,
  '70% +': 70,
  '80% +': 80,
  '90% +': 90,
}
