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
  id: string
  title: string
  company: string
  companyDescription?: string
  description?: string
  status: AdminListingStatus
  applicants: number
  posted: string
  deadline: string
}

export type AdminAppStats = {
  monthly: { month: string; apps: number }[]
  /** Percentage share per display status (sums to 100 when there is data). */
  breakdown: { name: string; value: number; color: string }[]
  total: number
  accepted: number
  pending: number
  rejected: number
}

export const EMPTY_APP_STATS: AdminAppStats = {
  monthly: [],
  breakdown: [],
  total: 0,
  accepted: 0,
  pending: 0,
  rejected: 0,
}
