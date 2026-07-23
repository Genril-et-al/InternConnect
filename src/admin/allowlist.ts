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
  course?: string
  yearLevel?: string
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

/**
 * Split a single "Full Name" into first / middle initial / last for the roster
 * columns.
 *
 * A middle initial is a lone letter sitting between the first name and the
 * surname, with or without its period — "Juan S Dela Cruz" and "Juan S. Dela
 * Cruz" both give first "Juan", middle "S.", last "Dela Cruz". The period comes
 * from formatMiddleInitial, so an admin who forgets to type it still gets the
 * canonical form on the roster.
 *
 * Everything after the initials is the surname, so compound names survive
 * intact ("Dela Cruz" is not mistaken for a middle name). A trailing lone
 * letter is read as the surname rather than an initial, since "Juan S" has no
 * surname to put after it.
 */
export function splitName(full: string): {
  firstName: string
  middleInitial: string
  lastName: string
} {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? '', middleInitial: '', lastName: '' }
  }

  const rest = parts.slice(1)
  // Take leading initials, but never the final token — that one is the
  // surname. An initial is a lone letter ("S", "S.") or letters that are
  // period-separated ("S.J."); the period is what distinguishes those from an
  // ordinary short name, so "Clara" and "Al" are left as part of the surname.
  const INITIALS = /^[A-Za-z]\.?$|^(?:[A-Za-z]\.)+[A-Za-z]?\.?$/
  const initials: string[] = []
  while (rest.length > 1 && INITIALS.test(rest[0])) {
    initials.push(rest.shift() as string)
  }

  return {
    firstName: parts[0],
    middleInitial: formatMiddleInitial(initials.join(' ')),
    lastName: rest.join(' '),
  }
}

function studentRow(s: NewApprovedStudent) {
  return {
    email: s.email.trim().toLowerCase(),
    first_name: clean(s.firstName),
    middle_initial: formatMiddleInitial(s.middleInitial) || null,
    last_name: clean(s.lastName),
    student_number: clean(s.studentNumber),
    course: clean(s.course),
    year_level: clean(s.yearLevel),
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
// File parsing for bulk upload. CSV is handled in-house (dependency-free);
// .xlsx/.xls go through SheetJS. Both funnel into the same string[][] shape,
// where the first row is the header.
// ---------------------------------------------------------------------------

/** True for the spreadsheet formats we hand to SheetJS rather than parseCsv. */
function isSpreadsheet(fileName: string): boolean {
  return /\.(xlsx|xlsm|xls)$/i.test(fileName)
}

/**
 * Read an uploaded roster into rows. Excel files are converted here so the
 * column-mapping below never has to care which format the NLO exported.
 *
 * SheetJS is imported lazily — it's ~400KB, and admins who upload CSVs (or
 * never open this modal) shouldn't pay for it.
 */
export async function readRosterFile(file: File): Promise<string[][]> {
  if (!isSpreadsheet(file.name)) return parseCsv(await file.text())

  const XLSX = await import('xlsx')
  const wb = XLSX.read(await file.arrayBuffer())
  const first = wb.SheetNames[0]
  if (!first) throw new Error('That workbook has no sheets in it.')

  // raw:false renders cells as their displayed text, which keeps student
  // numbers as "2021304" instead of the number 2021304 (and dates as dates
  // rather than Excel serials). defval:'' keeps blank cells as columns so
  // header positions still line up.
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[first], {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  })
  return rows.map((r) => r.map((cell) => (cell == null ? '' : String(cell))))
}

/** Human-readable list of sheets in a workbook, for the "which sheet?" notice. */
export async function sheetNames(file: File): Promise<string[]> {
  if (!isSpreadsheet(file.name)) return []
  const XLSX = await import('xlsx')
  return XLSX.read(await file.arrayBuffer(), { bookSheets: true }).SheetNames
}

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

export function parseStudentRows(rows: string[][]): NewApprovedStudent[] {
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
    let middleInitial = at(r, ['middleinitial', 'mi', 'middle'])
    const fullName = at(r, ['name', 'fullname'])
    if (!firstName && !lastName && fullName) {
      const parsed = splitName(fullName)
      firstName = parsed.firstName
      lastName = parsed.lastName
      // A dedicated middle column still wins; this only rescues the initial
      // from rosters that spell the whole name out in one cell.
      if (!middleInitial) middleInitial = parsed.middleInitial
    }
    out.push({
      email,
      firstName,
      middleInitial,
      lastName,
      studentNumber: at(r, ['studentnumber', 'studentno', 'studentid', 'idnumber']),
      course: at(r, ['course', 'program']),
      yearLevel: at(r, ['yearlevel', 'year']),
    })
  }
  return out
}

export function parseCompanyRows(rows: string[][]): NewApprovedCompany[] {
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
