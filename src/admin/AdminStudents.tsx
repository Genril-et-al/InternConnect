import { useMemo, useState } from 'react'
import { UserCheck, UserX, Plus, Upload, X, Trash2 } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import type { AdminStudent } from './adminData'
import {
  addApprovedStudent,
  addApprovedStudents,
  addApprovedCompanies,
  parseStudentsCsv,
  parseCompaniesCsv,
  splitName,
} from './allowlist'
import { removeApprovedStudent, setStudentActive } from './adminQueries'

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
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase()),
      ),
    [students, search],
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
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1 className="ad-title">Manage Students</h1>
          <p className="ad-subtitle">
            {students.length} student{students.length === 1 ? '' : 's'} on the roster
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ad-secondary" onClick={() => setShowBulkModal(true)} type="button" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={14} /> Add in Bulk
          </button>
          <button className="ad-primary" onClick={() => setShowAddModal(true)} type="button" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Student
          </button>
        </div>
      </div>

      <div className="ad-toolbar">
        <AdSearch onChange={setSearch} placeholder="Search by name or email…" value={search} />
      </div>

      {actionError && (
        <p style={{ margin: '0 0 12px', color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{actionError}</p>
      )}

      <div className="ad-table-wrap">
        <table className="ad-table">
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
                    <div className="ad-cell-person">
                      <span className="ad-cell-mark">
                        {s.name
                          .split(' ')
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                      {s.name}
                    </div>
                  </td>
                  <td className="ad-muted">{s.email}</td>
                  <td><AdBadge text={badge.text} variant={badge.variant} /></td>
                  <td>{s.applications}</td>
                  <td className="ad-muted">{s.joined}</td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="ad-empty" colSpan={5}>
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
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>
        <div className="ad-view">
          <div className="ad-view-head">
            <span className="ad-cell-mark" style={{ width: 48, height: 48, fontSize: 16 }}>{initials}</span>
            <div>
              <p className="ad-view-name">{student.name}</p>
              <AdBadge
                text={student.status === 'active' ? 'Active' : student.status === 'inactive' ? 'Inactive' : 'Not registered'}
                variant={student.status === 'active' ? 'success' : student.status === 'inactive' ? 'neutral' : 'pending'}
              />
            </div>
          </div>

          <dl className="ad-view-list">
            {rows.map(([label, value]) => (
              <div className="ad-view-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          {student.status === 'inactive' && student.deactivationReason && (
            <div className="ad-view-reason">
              <p className="ad-view-reason-label">Deactivation reason</p>
              <p className="ad-view-reason-text">{student.deactivationReason}</p>
              {student.deactivatedAt && (
                <p className="ad-muted" style={{ margin: '6px 0 0', fontSize: '11px' }}>
                  Deactivated {student.deactivatedAt}
                </p>
              )}
            </div>
          )}

          <div className="ad-view-actions" style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
            {student.registered ? (
              <button
                className="ad-secondary"
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
                className="ad-danger"
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
          <button className="modal-close" onClick={onClose} disabled={busy} type="button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <p className="ad-muted" style={{ margin: 0 }}>
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
            <button className="ad-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="ad-danger" type="submit" disabled={!reason.trim() || busy}>
              <UserX size={12} /> {busy ? 'Deactivating…' : 'Deactivate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AddStudentModal({ onClose, onAdded }: { onClose: () => void, onAdded: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [studentNumber, setStudentNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || busy) return
    setBusy(true)
    setError(null)
    const { firstName, lastName } = splitName(name)
    try {
      // Pre-clears the email so the student can self-register (UC-A03).
      await addApprovedStudent({ email, firstName, lastName, studentNumber })
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
          <button className="modal-close" onClick={onClose} disabled={busy} type="button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <p className="ad-muted" style={{ margin: 0 }}>
            This clears the student to self-register. They finish creating their account from the sign-up page.
          </p>
          <label className="cp-modal-label">
            Full Name *
            <input className="ad-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Juan Dela Cruz" required />
          </label>
          <label className="cp-modal-label">
            Email Address *
            <input className="ad-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. juan.delacruz@cit.edu" required />
          </label>
          <label className="cp-modal-label">
            Student Number
            <input className="ad-input" value={studentNumber} onChange={e => setStudentNumber(e.target.value)} placeholder="e.g. 21-1234-567 (optional)" />
          </label>
          {error && <p className="ad-form-error" style={{ margin: 0, color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button className="ad-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="ad-primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add Student'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function BulkUploadModal({ type, onClose, onDone }: { type: 'student' | 'company', onClose: () => void, onDone: () => Promise<void> }) {
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

    if (/\.xlsx?$/i.test(file.name)) {
      setError('Please save the sheet as CSV (File → Save As → CSV) and upload that. Excel files aren’t supported directly.')
      e.target.value = ''
      return
    }

    setUploading(true)
    try {
      const text = await file.text()
      if (type === 'student') {
        const parsed = parseStudentsCsv(text)
        if (parsed.length === 0) throw new Error('No valid rows found. The file needs a header row with an "email" column.')
        const added = await addApprovedStudents(parsed)
        setDone(`Added ${added} student${added === 1 ? '' : 's'} to the roster${added < parsed.length ? ` (${parsed.length - added} already existed)` : ''}.`)
      } else {
        const parsed = parseCompaniesCsv(text)
        if (parsed.length === 0) throw new Error('No valid rows found. The file needs a header row with "company_name" and "contact_email" columns.')
        const added = await addApprovedCompanies(parsed)
        setDone(`Added ${added} compan${added === 1 ? 'y' : 'ies'} to the allowlist${added < parsed.length ? ` (${parsed.length - added} already existed)` : ''}.`)
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
          <button className="modal-close" onClick={onClose} disabled={uploading} type="button"><X size={16} /></button>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p className="ad-muted" style={{ margin: 0 }}>
            Upload a CSV of {type === 'student' ? 'students' : 'companies'}. The first row must be a header
            with these columns: <code>{columns}</code>. Existing emails are skipped.
          </p>
          {done
            ? (
              <>
                <p style={{ margin: 0, color: 'var(--brand-green, #2e7d32)', fontSize: '14px', fontWeight: 500 }}>{done}</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="ad-primary" type="button" onClick={onClose}>Done</button>
                </div>
              </>
            )
            : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', border: '2px dashed var(--border)', borderRadius: '8px', cursor: uploading ? 'wait' : 'pointer', background: 'var(--bg-subtle)' }}>
                <Upload size={24} style={{ color: 'var(--text-light)', marginBottom: '8px' }} />
                <span style={{ fontWeight: 500 }}>{uploading ? 'Uploading…' : 'Click to select a CSV file'}</span>
                {!uploading && <span style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>Supported format: .csv</span>}
                <input type="file" hidden accept=".csv,text/csv" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
          {error && <p style={{ margin: 0, color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{error}</p>}
        </div>
      </div>
    </div>
  )
}
