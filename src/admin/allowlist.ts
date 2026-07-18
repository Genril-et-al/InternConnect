import { supabase } from '../lib/supabase'
import { formatMiddleInitial } from '../lib/name'

/**
 * Admin allowlist data-access (UC-A03).
 *
 * Adding an account in the admin portal does NOT create a login — it pre-clears
 * an email so that person can later self-register (the signup trigger checks
 * these rosters, see 0006_student_allowlist.sql). So "Add Student" writes to
 * `approved_students` and "Add Company" writes to `nlo_approved_companies`.
 *
 * Every write is gated server-side by RLS (`is_admin()`); these calls only
 * succeed for an authenticated admin session.
 */

export type NewApprovedStudent = {
  email: string
  firstName?: string
  middleInitial?: string
  lastName?: string
  studentNumber?: string
}

export type NewApprovedCompany = {
  companyName: string
  contactEmail: string
  identifier?: string
}

/** Postgres unique-violation — the email is already on the roster. */
const UNIQUE_VIOLATION = '23505'

function clean(v?: string): string | null {
  const t = (v ?? '').trim()
  return t.length ? t : null
}

/** Split a single "Full Name" into first / last for the roster columns. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function studentRow(s: NewApprovedStudent) {
  return {
    email: s.email.trim().toLowerCase(),
    first_name: clean(s.firstName),
    middle_initial: formatMiddleInitial(s.middleInitial) || null,
    last_name: clean(s.lastName),
    student_number: clean(s.studentNumber),
  }
}

function companyRow(c: NewApprovedCompany) {
  return {
    company_name: c.companyName.trim(),
    contact_email: c.contactEmail.trim().toLowerCase(),
    identifier: clean(c.identifier),
  }
}

function friendlyError(err: { code?: string; message: string }, subject: string): Error {
  if (err.code === UNIQUE_VIOLATION) {
    return new Error(`${subject} is already on the roster.`)
  }
  return new Error(err.message)
}

/** Add one student to the roster. */
export async function addApprovedStudent(input: NewApprovedStudent): Promise<void> {
  const { error } = await supabase.from('approved_students').insert(studentRow(input))
  if (error) throw friendlyError(error, input.email)
}

/** Add one company to the NLO allowlist. */
export async function addApprovedCompany(input: NewApprovedCompany): Promise<void> {
  const { error } = await supabase.from('nlo_approved_companies').insert(companyRow(input))
  if (error) throw friendlyError(error, input.contactEmail)
}

/**
 * Bulk insert. Rows that collide with an existing email are skipped (not an
 * error), so re-uploading a roster with a few new names just adds the new ones.
 * Returns how many rows were newly inserted.
 */
export async function addApprovedStudents(rows: NewApprovedStudent[]): Promise<number> {
  if (rows.length === 0) return 0
  const { data, error } = await supabase
    .from('approved_students')
    .upsert(rows.map(studentRow), { onConflict: 'email', ignoreDuplicates: true })
    .select('id')
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

export async function addApprovedCompanies(rows: NewApprovedCompany[]): Promise<number> {
  if (rows.length === 0) return 0
  const { data, error } = await supabase
    .from('nlo_approved_companies')
    .upsert(rows.map(companyRow), { onConflict: 'contact_email', ignoreDuplicates: true })
    .select('id')
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

// ---------------------------------------------------------------------------
// CSV parsing for bulk upload. Dependency-free: handles quoted fields, escaped
// quotes ("") and both \n and \r\n line endings. The first row is the header.
// ---------------------------------------------------------------------------

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += ch
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(field); field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  if (field !== '' || row.length) {
    row.push(field)
    if (row.some((c) => c.trim() !== '')) rows.push(row)
  }
  return rows
}

/** Map header names to column indexes (case/space/underscore-insensitive). */
function headerIndex(header: string[]): Record<string, number> {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, '')
  const idx: Record<string, number> = {}
  header.forEach((h, i) => { idx[norm(h)] = i })
  return idx
}

export function parseStudentsCsv(text: string): NewApprovedStudent[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const idx = headerIndex(rows[0])
  const at = (r: string[], keys: string[]) => {
    for (const k of keys) if (idx[k] !== undefined) return r[idx[k]]?.trim() ?? ''
    return ''
  }
  const out: NewApprovedStudent[] = []
  for (const r of rows.slice(1)) {
    const email = at(r, ['email', 'emailaddress'])
    if (!email) continue
    let firstName = at(r, ['firstname', 'first'])
    let lastName = at(r, ['lastname', 'last', 'surname'])
    const middleInitial = at(r, ['middleinitial', 'mi', 'middle'])
    const fullName = at(r, ['name', 'fullname'])
    if (!firstName && !lastName && fullName) ({ firstName, lastName } = splitName(fullName))
    out.push({
      email,
      firstName,
      middleInitial,
      lastName,
      studentNumber: at(r, ['studentnumber', 'studentno', 'studentid', 'idnumber']),
    })
  }
  return out
}

export function parseCompaniesCsv(text: string): NewApprovedCompany[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const idx = headerIndex(rows[0])
  const at = (r: string[], keys: string[]) => {
    for (const k of keys) if (idx[k] !== undefined) return r[idx[k]]?.trim() ?? ''
    return ''
  }
  const out: NewApprovedCompany[] = []
  for (const r of rows.slice(1)) {
    const companyName = at(r, ['companyname', 'company', 'name'])
    const contactEmail = at(r, ['contactemail', 'email', 'emailaddress'])
    if (!companyName || !contactEmail) continue
    out.push({
      companyName,
      contactEmail,
      identifier: at(r, ['identifier', 'dti', 'sec', 'businesspermit', 'permitno', 'id']),
    })
  }
  return out
}
