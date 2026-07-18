/**
 * Admin portal seed data — replaced by Supabase queries (profiles, companies,
 * listings, applications) in a later slice.
 */

// 'pending' = rostered/invited but has not signed up yet (no account exists).
export type StudentStatus = 'active' | 'inactive' | 'pending'
export type VerifStatus = 'verified' | 'pending' | 'rejected'
export type AdminListingStatus = 'open' | 'closed' | 'flagged'

export type AdminStudent = {
  id: string // roster email — stable unique key
  name: string
  email: string
  status: StudentStatus
  registered: boolean
  profileId?: string // set once the student has an account (enables activate/deactivate)
  applications: number
  joined: string
  // Account details shown in the "View account" modal (UC-A01).
  studentId?: string
  program?: string
  year?: string
  phone?: string
  // Recorded when an admin deactivates the account; cleared on reactivation.
  deactivationReason?: string
  deactivatedAt?: string
}

export type AdminCompany = {
  id: string // allowlist contact email — stable unique key
  name: string
  industry: string
  verification: VerifStatus
  registered: boolean
  companyId?: string // set once the company has an account (enables approve/reject)
  contactEmail: string
  docs: number
  submitted: string
  listings: number
}

export type AdminListing = {
  id: number
  title: string
  company: string
  companyDescription?: string
  status: AdminListingStatus
  applicants: number
  posted: string
  deadline: string
}

// Fake seeded students removed — the Manage Students table starts empty and is
// populated by real admin actions (Add Student / bulk) writing to the
// approved_students roster. Company seeds below are still placeholders.
export const SEED_ADMIN_STUDENTS: AdminStudent[] = []

// Loaded live from Supabase (admin_list_companies) in AdminApp; empty until then.
export const SEED_ADMIN_COMPANIES: AdminCompany[] = []

export const SEED_ADMIN_LISTINGS: AdminListing[] = [
  { id: 1, title: 'Frontend Developer Intern', company: 'Arcway Labs', companyDescription: 'Arcway Labs is a Cebu-based software studio building internal tools and dashboards for growing companies.', status: 'open', applicants: 24, posted: 'Jul 1', deadline: 'Jul 29' },
  { id: 2, title: 'Data Operations Intern', company: 'Harbor Analytics', companyDescription: 'Harbor Analytics is a leading business intelligence firm providing data cleaning, reporting, and operational insights.', status: 'open', applicants: 17, posted: 'Jul 2', deadline: 'Aug 5' },
  { id: 3, title: 'Marketing Intern', company: 'BrandPulse PH', companyDescription: 'BrandPulse PH is a boutique digital marketing agency specializing in brand strategy, campaigns, and search engine optimization.', status: 'open', applicants: 8, posted: 'Jul 5', deadline: 'Jul 25' },
  { id: 4, title: 'UI/UX Design Intern', company: 'Northstar Systems', companyDescription: 'Northstar Systems is an enterprise software company delivering high-quality automated testing and quality assurance solutions.', status: 'closed', applicants: 12, posted: 'Jun 15', deadline: 'Jul 10' },
  { id: 5, title: 'QA Automation Intern', company: 'Northstar Systems', companyDescription: 'Northstar Systems is an enterprise software company delivering high-quality automated testing and quality assurance solutions.', status: 'open', applicants: 5, posted: 'Jul 8', deadline: 'Aug 8' },
]

export const MONTHLY_APPLICATIONS = [
  { month: 'Feb', apps: 84 },
  { month: 'Mar', apps: 132 },
  { month: 'Apr', apps: 109 },
  { month: 'May', apps: 178 },
  { month: 'Jun', apps: 203 },
  { month: 'Jul', apps: 165 },
]

export const STATUS_BREAKDOWN = [
  { name: 'Accepted', value: 34, color: 'var(--brand-orange)' },
  { name: 'Pending', value: 45, color: 'var(--brand-beige)' },
  { name: 'Rejected', value: 21, color: 'var(--brand-crimson)' },
]
