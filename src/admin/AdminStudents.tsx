import { useMemo, useState } from 'react'
import { UserCheck, UserX, Plus, Upload, X, Trash2 } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import type { AdminStudent } from './adminData'
import {
  addApprovedStudent,
  addApprovedStudents,
  addApprovedCompanies,
  parseStudentRows,
  parseCompanyRows,
  readRosterFile,
  sheetNames,
  splitName,
} from './allowlist'
import { removeApprovedStudent, setStudentActive } from './adminQueries'
import { Dropdown } from '../components/Dropdown'
import { useScrollLock } from '../lib/useScrollLock'

/**
 * Students are rostered by their university address, never a personal one: it
 * is the identity handle_new_user matches against the roster at sign-up
 * (migration 0013), so a personal address here would clear an account that can
 * never be resolved back to this student.
 */
const STUDENT_EMAIL_DOMAIN = '@cit.edu'

/** UC-A01 — Manage Student Accounts: roster, activate, deactivate. */
export function AdminStudents({
  students,
  loading,
  loadError,
  onRefresh,
}: {
  students: AdminStudent[]
  loading: boolean
  loadError: string | null
  onRefresh: () => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all')
  const [majorFilter, setMajorFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [skillFilter, setSkillFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [viewTarget, setViewTarget] = useState<AdminStudent | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<AdminStudent | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          (filter === 'all' || s.status === filter) &&
          (majorFilter === 'all' || s.program === majorFilter) &&
          (yearFilter === 'all' || s.year === yearFilter) &&
          (skillFilter === '' || (s.skills && s.skills.some((sk) => sk.toLowerCase().includes(skillFilter.toLowerCase())))) &&
          (s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.email.toLowerCase().includes(search.toLowerCase())),
      ),
    [students, search, filter, majorFilter, yearFilter, skillFilter],
  )

  async function runAction(id: string, fn: () => Promise<void>) {
    setBusyId(id)
    setActionError(null)
    try {
      await fn()
      await onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }

  const activate = (s: AdminStudent) =>
    s.profileId && runAction(s.id, () => setStudentActive(s.profileId!, true))

  const remove = (s: AdminStudent) =>
    runAction(s.id, () => removeApprovedStudent(s.email))

  const handleToggle = (s: AdminStudent) => {
    if (s.status === 'active') setDeactivateTarget(s)
    else if (s.status === 'inactive') activate(s)
  }

  const statusBadge = (s: AdminStudent) =>
    s.status === 'active'
      ? { text: 'Active', variant: 'success' as const }
      : s.status === 'inactive'
        ? { text: 'Inactive', variant: 'neutral' as const }
        : { text: 'Not registered', variant: 'pending' as const }

  return (
    <div className="ic-page">
      <div className="ic-page-head">
        <div>
          <h1 className="ic-title">Manage Students</h1>
          <p className="ic-subtitle">
            {students.length} student{students.length === 1 ? '' : 's'} on the roster
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ic-secondary" onClick={() => setShowBulkModal(true)} type="button" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={14} /> Add in Bulk
          </button>
          <button className="ic-primary" onClick={() => setShowAddModal(true)} type="button" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Student
          </button>
        </div>
      </div>

      <div className="ic-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <AdSearch onChange={setSearch} placeholder="Search by name or email…" value={search} />
        <Dropdown
          ariaLabel="Filter by status"
          onChange={(v) => setFilter(v as 'all' | 'active' | 'inactive' | 'pending')}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'pending', label: 'Not registered' },
          ]}
          value={filter}
        />
        <Dropdown
          ariaLabel="Filter by major"
          onChange={setMajorFilter}
          options={[
            { value: 'all', label: 'All Majors' },
            'BSCS',
            'BSIT',
            'BSIS',
          ]}
          value={majorFilter}
        />
        <Dropdown
          ariaLabel="Filter by year level"
          onChange={setYearFilter}
          options={[
            { value: 'all', label: 'All Years' },
            '1st Year',
            '2nd Year',
            '3rd Year',
            '4th Year',
          ]}
          value={yearFilter}
        />
        <input
          className="ic-select"
          style={{ padding: '8px 12px', minWidth: '130px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--surface)', fontSize: '13px' }}
          type="text"
          placeholder="Filter by skill…"
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
        />
      </div>

      {actionError && (
        <p style={{ margin: '0 0 12px', color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{actionError}</p>
      )}

      <div className="ic-table-wrap">
        <table className="ic-table">
          <thead>
            <tr>
              {['Student', 'Email', 'Status', 'Applications', 'Joined'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const badge = statusBadge(s)
              return (
                <tr key={s.id} onClick={() => setViewTarget(s)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div className="ic-cell-person">
                      <span className="ic-cell-mark">
                        {s.name
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                      <div>
                        <div>{s.name}</div>
                        {s.studentId && <p className="ic-muted" style={{ fontSize: '11px', margin: '2px 0 0' }}>{s.studentId}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="ic-muted">{s.email}</td>
                  <td><AdBadge text={badge.text} variant={badge.variant} /></td>
                  <td>{s.applications}</td>
                  <td className="ic-muted">{s.joined}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="ic-empty" colSpan={5}>
                  {loading ? 'Loading students…' : loadError ? `Could not load students: ${loadError}` : 'No students found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} onAdded={onRefresh} />}
      {showBulkModal && <BulkUploadModal type="student" onClose={() => setShowBulkModal(false)} onDone={onRefresh} />}
      {viewTarget && (
        <ViewStudentModal
          student={students.find((s) => s.id === viewTarget.id) || viewTarget}
          busy={busyId === viewTarget.id}
          onClose={() => setViewTarget(null)}
          onToggle={(s) => {
            handleToggle(s)
            if (s.status === 'active') {
              setViewTarget(null)
            }
          }}
          onRemove={(s) => {
            remove(s)
            setViewTarget(null)
          }}
        />
      )}
      {deactivateTarget && (
        <DeactivateStudentModal
          student={deactivateTarget}
          busy={busyId === deactivateTarget.id}
          onClose={() => setDeactivateTarget(null)}
          onConfirm={async (reason) => {
            const target = deactivateTarget
            if (target.profileId) {
              await runAction(target.id, () => setStudentActive(target.profileId!, false, reason))
            }
            setDeactivateTarget(null)
          }}
        />
      )}
    </div>
  )
}

/** UC-A01 — read-only view of a student's account information. */
function ViewStudentModal({
  student,
  busy,
  onClose,
  onToggle,
  onRemove,
}: {
  student: AdminStudent
  busy: boolean
  onClose: () => void
  onToggle: (s: AdminStudent) => void
  onRemove: (s: AdminStudent) => void
}) {
  useScrollLock()

  const initials = student.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  const rows: [string, string | number][] = [
    ['Email', student.email],
    ['Student ID', student.studentId ?? '—'],
    ['Program', student.program ?? '—'],
    ['Year Level', student.year ?? '—'],
    ['Contact No.', student.phone ?? '—'],
    ['Applications', student.applications],
    ['Joined', student.joined],
  ]

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" style={{ width: '440px' }}>
        <div className="modal-header">
          <h3>Student Account</h3>
          <button aria-label="Close" className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>
        <div className="ic-view">
          <div className="ic-view-head">
            <span className="ic-cell-mark" style={{ width: 48, height: 48, fontSize: 16 }}>{initials}</span>
            <div>
              <p className="ic-view-name">
                {student.name} {student.studentId && <span className="ic-muted" style={{ fontSize: '13px', fontWeight: 500 }}>({student.studentId})</span>}
              </p>
              <AdBadge
                text={student.status === 'active' ? 'Active' : student.status === 'inactive' ? 'Inactive' : 'Not registered'}
                variant={student.status === 'active' ? 'success' : student.status === 'inactive' ? 'neutral' : 'pending'}
              />
            </div>
          </div>

          <dl className="ic-view-list">
            {rows.map(([label, value]) => (
              <div className="ic-view-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          {student.status === 'inactive' && student.deactivationReason && (
            <div className="ic-view-reason">
              <p className="ic-view-reason-label">Deactivation reason</p>
              <p className="ic-view-reason-text">{student.deactivationReason}</p>
              {student.deactivatedAt && (
                <p className="ic-muted" style={{ margin: '6px 0 0', fontSize: '11px' }}>
                  Deactivated {student.deactivatedAt}
                </p>
              )}
            </div>
          )}

          <div className="ic-view-actions" style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
            {student.registered ? (
              <button
                className="ic-secondary"
                onClick={() => onToggle(student)}
                type="button"
                disabled={busy}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {student.status === 'active' ? (
                  <><UserX size={14} /> Deactivate</>
                ) : (
                  <><UserCheck size={14} /> Activate</>
                )}
              </button>
            ) : (
              <button
                className="ic-danger"
                onClick={() => onRemove(student)}
                type="button"
                disabled={busy}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Trash2 size={14} /> {busy ? 'Removing…' : 'Remove'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** UC-A01 — deactivation requires a recorded reason. */
function DeactivateStudentModal({
  student,
  onConfirm,
  onClose,
  busy,
}: {
  student: AdminStudent
  onConfirm: (reason: string) => void
  onClose: () => void
  busy: boolean
}) {
  useScrollLock()

  const [reason, setReason] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim() || busy) return
    onConfirm(reason.trim())
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="modal-panel" style={{ width: '420px' }}>
        <div className="modal-header">
          <h3>Deactivate Account</h3>
          <button aria-label="Close" className="modal-close" onClick={onClose} disabled={busy} type="button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <p className="ic-muted" style={{ margin: 0 }}>
            You're deactivating{' '}
            <strong style={{ color: 'var(--text-strong)' }}>{student.name}</strong>. They'll lose
            access until reactivated. Please record a reason.
          </p>
          <label className="cp-modal-label">
            Reason for deactivation *
            <textarea
              autoFocus
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Graduated / no longer enrolled, policy violation, duplicate account…"
              required
              value={reason}
            />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="ic-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="ic-danger" type="submit" disabled={!reason.trim() || busy}>
              <UserX size={12} /> {busy ? 'Deactivating…' : 'Deactivate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddStudentModal({ onClose, onAdded }: { onClose: () => void, onAdded: () => Promise<void> }) {
  useScrollLock()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [course, setCourse] = useState('')
  const [yearLevel, setYearLevel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !studentNumber || !course || !yearLevel || busy) return
    // Normalised before both the check and the write, so the roster can't end
    // up holding an address that differs from the sign-up one only by case.
    const institutionalEmail = email.trim().toLowerCase()
    if (!institutionalEmail.endsWith(STUDENT_EMAIL_DOMAIN)) {
      setError(`Enter the student's institutional email — it must end in ${STUDENT_EMAIL_DOMAIN}.`)
      return
    }
    setBusy(true)
    setError(null)
    const { firstName, lastName } = splitName(name)
    try {
      // Pre-clears the email so the student can self-register (UC-A03).
      await addApprovedStudent({ email: institutionalEmail, firstName, lastName, studentNumber, course, yearLevel })
      await onAdded() // reload from the roster so the new row shows accurately
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the student.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="modal-panel" style={{ width: '400px' }}>
        <div className="modal-header">
          <h3>Add New Student</h3>
          <button aria-label="Close" className="modal-close" onClick={onClose} disabled={busy} type="button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <p className="ic-muted" style={{ margin: 0 }}>
            This clears the student to self-register. They finish creating their account from the sign-up page.
          </p>
          <label className="cp-modal-label">
            Full Name *
            <input className="ic-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Juan Dela Cruz" required />
          </label>
          <label className="cp-modal-label">
            Institutional Email *
            <input
              className="ic-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={`e.g. juan.delacruz${STUDENT_EMAIL_DOMAIN}`}
              required
            />
            <span className="ic-muted" style={{ fontSize: '12px', fontWeight: 400 }}>
              Must be the student's {STUDENT_EMAIL_DOMAIN} address.
            </span>
          </label>
          <label className="cp-modal-label">
            Student Number *
            <input className="ic-input" value={studentNumber} onChange={e => setStudentNumber(e.target.value)} placeholder="e.g. 21-1234-567" required />
          </label>
          <label className="cp-modal-label">
            Course/Program *
            <input className="ic-input" value={course} onChange={e => setCourse(e.target.value)} placeholder="e.g. BSCS" required />
          </label>
          <label className="cp-modal-label">
            Year Level *
            <input className="ic-input" value={yearLevel} onChange={e => setYearLevel(e.target.value)} placeholder="e.g. 3rd Year" required />
          </label>
          {error && <p className="ic-form-error" style={{ margin: 0, color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button className="ic-primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add Student'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function BulkUploadModal({ type, onClose, onDone }: { type: 'student' | 'company', onClose: () => void, onDone: () => Promise<void> }) {
  useScrollLock()

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const columns = type === 'student'
    ? 'email (required), first_name, last_name, student_number'
    : 'company_name (required), contact_email (required), identifier'

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setDone(null)

    setUploading(true)
    try {
      const rows = await readRosterFile(file)
      // A workbook with several sheets only gets its first one read; say so
      // rather than silently ignoring the rest.
      const sheets = await sheetNames(file)
      const sheetNote = sheets.length > 1 ? ` Only the first sheet ("${sheets[0]}") was read.` : ''

      if (type === 'student') {
        const parsed = parseStudentRows(rows)
        if (parsed.length === 0) throw new Error('No valid rows found. The file needs a header row with an "email" column.')
        const added = await addApprovedStudents(parsed)
        setDone(`Added ${added} student${added === 1 ? '' : 's'} to the roster${added < parsed.length ? ` (${parsed.length - added} already existed)` : ''}.${sheetNote}`)
      } else {
        const parsed = parseCompanyRows(rows)
        if (parsed.length === 0) throw new Error('No valid rows found. The file needs a header row with "company_name" and "contact_email" columns.')
        const added = await addApprovedCompanies(parsed)
        setDone(`Added ${added} compan${added === 1 ? 'y' : 'ies'} to the allowlist${added < parsed.length ? ` (${parsed.length - added} already existed)` : ''}.${sheetNote}`)
      }
      await onDone() // reload from the database so new rows appear
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !uploading) onClose() }}>
      <div className="modal-panel" style={{ width: '420px' }}>
        <div className="modal-header">
          <h3>Add in Bulk</h3>
          <button aria-label="Close" className="modal-close" onClick={onClose} disabled={uploading} type="button"><X size={16} /></button>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p className="ic-muted" style={{ margin: 0 }}>
            Upload a CSV or Excel file of {type === 'student' ? 'students' : 'companies'}. The first row must be a header
            with these columns: <code>{columns}</code>. Existing emails are skipped.
          </p>
          {done
            ? (
              <>
                <p style={{ margin: 0, color: 'var(--brand-green, #2e7d32)', fontSize: '14px', fontWeight: 500 }}>{done}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="ic-primary" type="button" onClick={onClose}>Done</button>
                </div>
              </>
            )
            : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', border: '2px dashed var(--border)', borderRadius: '8px', cursor: uploading ? 'wait' : 'pointer', background: 'var(--bg-subtle)' }}>
                <Upload size={24} style={{ color: 'var(--text-light)', marginBottom: '8px' }} />
                <span style={{ fontWeight: 500 }}>{uploading ? 'Uploading…' : 'Click to select a file'}</span>
                {!uploading && <span style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>Supported formats: .csv, .xlsx, .xls</span>}
                <input type="file" hidden accept=".csv,text/csv,.xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          {error && <p style={{ margin: 0, color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}
