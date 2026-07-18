import { supabase } from '../lib/supabase'
import type {
  AdminAppStats,
  AdminCompany,
  AdminListing,
  AdminStudent,
  StudentStatus,
  VerifStatus,
} from './adminData'

/**
 * Live admin data (UC-A01 / UC-A02). Reads go through the `admin_list_*`
 * SECURITY DEFINER functions (0007_admin_panel_data.sql), which return the
 * roster joined to any account the person has created. Writes update the
 * account row directly and are gated by RLS (`is_admin()`).
 */

function monthYear(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

type StudentRow = {
  email: string
  full_name: string | null
  student_number: string | null
  is_registered: boolean
  profile_id: string | null
  is_active: boolean
  deactivation_reason: string | null
  deactivated_at: string | null
  application_count: number
  joined: string
}

function studentStatus(row: StudentRow): StudentStatus {
  if (!row.is_registered) return 'pending'
  return row.is_active ? 'active' : 'inactive'
}

export async function fetchStudents(): Promise<AdminStudent[]> {
  const { data, error } = await supabase.rpc('admin_list_students')
  if (error) throw new Error(error.message)
  return (data as StudentRow[]).map((r) => ({
    id: r.email,
    name: r.full_name || r.email,
    email: r.email,
    status: studentStatus(r),
    registered: r.is_registered,
    profileId: r.profile_id ?? undefined,
    applications: Number(r.application_count) || 0,
    joined: monthYear(r.joined),
    studentId: r.student_number ?? undefined,
    deactivationReason: r.deactivation_reason ?? undefined,
    deactivatedAt: r.deactivated_at ? monthYear(r.deactivated_at) : undefined,
  }))
}

type CompanyRow = {
  contact_email: string
  name: string
  industry: string
  verification: string
  is_registered: boolean
  company_id: string | null
  docs: number
  listings: number
  submitted: string
}

export async function fetchCompanies(): Promise<AdminCompany[]> {
  const { data, error } = await supabase.rpc('admin_list_companies')
  if (error) throw new Error(error.message)
  return (data as CompanyRow[]).map((r) => ({
    id: r.contact_email,
    name: r.name,
    industry: r.industry,
    verification: (r.verification as VerifStatus) ?? 'pending',
    registered: r.is_registered,
    companyId: r.company_id ?? undefined,
    contactEmail: r.contact_email,
    docs: Number(r.docs) || 0,
    submitted: monthYear(r.submitted),
    listings: Number(r.listings) || 0,
  }))
}

/** Activate / deactivate a registered student's account (UC-A01). */
export async function setStudentActive(
  profileId: string,
  active: boolean,
  reason?: string,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      is_active: active,
      deactivation_reason: active ? null : (reason ?? null),
      deactivated_at: active ? null : new Date().toISOString(),
    })
    .eq('id', profileId)
  if (error) throw new Error(error.message)
}

/** Set a registered company's verification state (UC-A02). */
export async function setCompanyVerification(
  companyId: string,
  status: VerifStatus,
): Promise<void> {
  const { error } = await supabase
    .from('companies')
    .update({ verification: status })
    .eq('id', companyId)
  if (error) throw new Error(error.message)
}

type AdminListingRow = {
  id: string
  title: string
  status: string
  description: string | null
  is_flagged: boolean
  deadline: string | null
  created_at: string
  companies: { name: string; description: string | null } | null
  applications: { count: number }[]
}

/** All listings platform-wide with applicant counts (UC-A04). */
export async function fetchAdminListings(): Promise<AdminListing[]> {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, status, description, is_flagged, deadline, created_at, companies(name, description), applications(count)')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as unknown as AdminListingRow[]).map((r) => ({
    id: r.id,
    title: r.title,
    company: r.companies?.name ?? '—',
    companyDescription: r.companies?.description ?? undefined,
    description: r.description ?? undefined,
    status: r.is_flagged ? 'flagged' : r.status === 'open' ? 'open' : 'closed',
    applicants: r.applications?.[0]?.count ?? 0,
    posted: monthYear(r.created_at),
    deadline: r.deadline ? monthYear(r.deadline) : '—',
  }))
}

/** Flag / unflag a listing (UC-A04); only is_admin() may change is_flagged. */
export async function setListingFlagged(listingId: string, flagged: boolean): Promise<void> {
  const { error } = await supabase
    .from('listings')
    .update({ is_flagged: flagged })
    .eq('id', listingId)
  if (error) throw new Error(error.message)
}

const BREAKDOWN_STYLES: { name: string; statuses: string[]; color: string }[] = [
  { name: 'Accepted', statuses: ['accepted'], color: 'var(--brand-orange)' },
  {
    name: 'In progress',
    statuses: ['pending', 'under_review', 'shortlisted', 'interview_scheduled'],
    color: 'var(--brand-orange-soft)',
  },
  { name: 'Rejected', statuses: ['rejected'], color: 'var(--brand-crimson)' },
]

/** Platform-wide application stats for the dashboard charts and reports. */
export async function fetchAppStats(): Promise<AdminAppStats> {
  const { data, error } = await supabase.from('applications').select('status, created_at')
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as { status: string; created_at: string }[]

  const byMonth = new Map<string, number>()
  for (const r of rows) {
    const key = monthYear(r.created_at)
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1)
  }
  const monthly = [...byMonth.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([month, apps]) => ({ month: month.split(' ')[0], apps }))

  const total = rows.length
  const count = (statuses: string[]) => rows.filter((r) => statuses.includes(r.status)).length
  const breakdown = total
    ? BREAKDOWN_STYLES.map((b) => ({
        name: b.name,
        value: Math.round((count(b.statuses) / total) * 100),
        color: b.color,
      })).filter((b) => b.value > 0)
    : []

  return {
    monthly,
    breakdown,
    total,
    accepted: count(['accepted']),
    rejected: count(['rejected']),
    pending: total - count(['accepted']) - count(['rejected']),
  }
}

/** Remove a student from the roster (only meaningful before they register). */
export async function removeApprovedStudent(email: string): Promise<void> {
  const { error } = await supabase
    .from('approved_students')
    .delete()
    .eq('email', email.trim().toLowerCase())
  if (error) throw new Error(error.message)
}
