/**
 * Admin portal seed data — replaced by Supabase queries (profiles, companies,
 * listings, applications) in a later slice.
 */

export type StudentStatus = 'active' | 'inactive'
export type VerifStatus = 'verified' | 'pending' | 'rejected'
export type AdminListingStatus = 'open' | 'closed' | 'flagged'

export type AdminStudent = {
  id: number
  name: string
  email: string
  status: StudentStatus
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
  id: number
  name: string
  industry: string
  verification: VerifStatus
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

export const SEED_ADMIN_STUDENTS: AdminStudent[] = [
  { id: 1, name: 'Chielsea S. Napoles', email: 'chielsea.napoles@cit.edu', status: 'active', applications: 3, joined: 'Jul 2026', studentId: '21-1234-567', program: 'BS Information Technology', year: '3rd Year', phone: '0917 123 4567' },
  { id: 2, name: 'Maria Santos', email: 'maria.santos@cit.edu', status: 'active', applications: 3, joined: 'Jan 2026', studentId: '20-2345-678', program: 'BS Computer Science', year: '4th Year', phone: '0918 234 5678' },
  { id: 3, name: 'Carlo Reyes', email: 'carlo.reyes@cit.edu', status: 'active', applications: 5, joined: 'Jan 2026', studentId: '21-3456-789', program: 'BS Computer Engineering', year: '3rd Year', phone: '0919 345 6789' },
  { id: 4, name: 'Lena Cruz', email: 'lena.cruz@cit.edu', status: 'inactive', applications: 1, joined: 'Feb 2026', studentId: '19-4567-890', program: 'BS Information Systems', year: '4th Year', phone: '0920 456 7890', deactivationReason: 'Graduated — no longer enrolled for the internship term.', deactivatedAt: 'Feb 20, 2026' },
  { id: 5, name: 'James Tan', email: 'james.tan@cit.edu', status: 'active', applications: 7, joined: 'Jan 2026', studentId: '20-5678-901', program: 'BS Computer Science', year: '4th Year', phone: '0921 567 8901' },
  { id: 6, name: 'Anna Dela Cruz', email: 'anna.delacruz@cit.edu', status: 'active', applications: 2, joined: 'Mar 2026', studentId: '22-6789-012', program: 'BS Information Technology', year: '2nd Year', phone: '0922 678 9012' },
]

export const SEED_ADMIN_COMPANIES: AdminCompany[] = [
  { id: 1, name: 'Arcway Labs', industry: 'Software', verification: 'verified', docs: 3, submitted: 'Jun 1', listings: 2 },
  { id: 2, name: 'Harbor Analytics', industry: 'Business Intelligence', verification: 'pending', docs: 2, submitted: 'Jul 11', listings: 0 },
  { id: 3, name: 'Green Roots Farms', industry: 'Agriculture', verification: 'pending', docs: 4, submitted: 'Jul 12', listings: 0 },
  { id: 4, name: 'BrandPulse PH', industry: 'Marketing', verification: 'verified', docs: 3, submitted: 'May 5', listings: 1 },
  { id: 5, name: 'CoreSystems', industry: 'Software', verification: 'rejected', docs: 1, submitted: 'Jul 1', listings: 0 },
  { id: 6, name: 'Northstar Systems', industry: 'Software', verification: 'verified', docs: 3, submitted: 'Apr 20', listings: 4 },
]

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
