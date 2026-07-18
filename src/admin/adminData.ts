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

// Seed listings and report figures removed — these views read live data once
// the Supabase listings + applications slice lands. Empty until then.
export const SEED_ADMIN_LISTINGS: AdminListing[] = []

export const MONTHLY_APPLICATIONS: { month: string; apps: number }[] = []

export const STATUS_BREAKDOWN: { name: string; value: number; color: string }[] = []
