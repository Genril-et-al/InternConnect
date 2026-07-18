import { supabase } from '../lib/supabase'
import type { AdminCompany, AdminStudent, StudentStatus, VerifStatus } from './adminData'

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

/** Remove a student from the roster (only meaningful before they register). */
export async function removeApprovedStudent(email: string): Promise<void> {
  const { error } = await supabase
    .from('approved_students')
    .delete()
    .eq('email', email.trim().toLowerCase())
  if (error) throw new Error(error.message)
}
