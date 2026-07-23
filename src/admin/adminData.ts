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
  skills?: string[]
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
  location?: string
  tier?: string
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
  setup?: 'onsite' | 'remote' | 'hybrid'
  isPaid?: boolean
  isFullTime?: boolean
}

export type AdminAppStats = {
  monthly: { month: string; apps: number }[]
  /** Percentage share per display status (sums to 100 when there is data). */
  breakdown: { name: string; value: number; color: string }[]
  total: number
  accepted: number
  pending: number
  rejected: number
  placementRate: number
  avgProcessingTimeDays: number
}

export const EMPTY_APP_STATS: AdminAppStats = {
  monthly: [],
  breakdown: [],
  total: 0,
  accepted: 0,
  pending: 0,
  rejected: 0,
  placementRate: 0,
  avgProcessingTimeDays: 0,
}

/**
 * A skill the matcher met but could not place in the taxonomy. Collected from
 * every student's browser (see skillGapSync.ts) so the backlog that
 * `npm run skills:learn` works through lives in one place.
 */
export type AdminSkillGap = {
  skill: string
  firstSeen: string
  lastSeen: string
  timesSeen: number
}
