/**
 * Shared prototype seed data. Replaced by Supabase tables (listings,
 * applications) in a later slice — keep UI components reading from here so the
 * swap is one file.
 */

export type ApplicationStatus =
  | 'Pending'
  | 'Under review'
  | 'Shortlisted'
  | 'Interview scheduled'
  | 'Accepted'
  | 'Rejected'

export type Internship = {
  id: number
  title: string
  company: string
  industry: string
  location: string
  setup: 'Onsite' | 'Remote' | 'Hybrid'
  deadline: string
  duration: string
  slots: number
  match: number
  status: 'Open' | 'Closing soon' | 'Closed'
  skills: string[]
  summary: string
}

export type PreEmploymentRequirement = {
  id: string
  name: string
  type: 'file' | 'text'
  isPrintable: boolean
}

export type Application = {
  id: number
  internshipId: number
  company: string
  role: string
  dateApplied: string
  status: ApplicationStatus
  nextStep: string
  requirements?: PreEmploymentRequirement[]
  approvedRequirements?: number
}


// Mock listings/applications removed — both views read live data once the
// Supabase listings + applications slice lands. Empty until then.
export const internships: Internship[] = []

export const applications: Application[] = []
