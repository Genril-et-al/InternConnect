import { useMemo, useState } from 'react'
import { UserCheck, UserX, Plus, Upload, X } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import type { AdminStudent } from './adminData'

/** UC-A01 — Manage Student Accounts: search, activate, deactivate. */
export function AdminStudents({
  students,
  setStudents,
}: {
  students: AdminStudent[]
  setStudents: React.Dispatch<React.SetStateAction<AdminStudent[]>>
}) {
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)

  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.email.toLowerCase().includes(search.toLowerCase()),
      ),
    [students, search],
  )

  const toggle = (id: number) =>
    setStudents((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s,
      ),
    )

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1 className="ad-title">Manage Students</h1>
          <p className="ad-subtitle">{students.length} registered students</p>
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

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              {['Student', 'Email', 'Status', 'Applications', 'Joined', 'Actions'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
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
                <td>
                  <AdBadge
                    text={s.status === 'active' ? 'Active' : 'Inactive'}
                    variant={s.status === 'active' ? 'success' : 'neutral'}
                  />
                </td>
                <td>{s.applications}</td>
                <td className="ad-muted">{s.joined}</td>
                <td>
                  <button className="ad-secondary" onClick={() => toggle(s.id)} type="button">
                    {s.status === 'active' ? (
                      <>
                        <UserX size={12} /> Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck size={12} /> Activate
                      </>
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="ad-empty" colSpan={6}>
                  No students found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddStudentModal onClose={() => setShowAddModal(false)} setStudents={setStudents} />}
      {showBulkModal && <BulkUploadModal type="student" onClose={() => setShowBulkModal(false)} setStudents={setStudents} />}
    </div>
  )
}

function AddStudentModal({ onClose, setStudents }: { onClose: () => void, setStudents: React.Dispatch<React.SetStateAction<AdminStudent[]>> }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email) return
    const newStudent: AdminStudent = {
      id: Date.now(),
      name,
      email,
      status: 'active',
      applications: 0,
      joined: new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
    }
    setStudents(prev => [newStudent, ...prev])
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" style={{ width: '400px' }}>
        <div className="modal-header">
          <h3>Add New Student</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <label className="cp-modal-label">
            Full Name *
            <input className="ad-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Juan Dela Cruz" required />
          </label>
          <label className="cp-modal-label">
            Email Address *
            <input className="ad-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g. juan@student.edu.ph" required />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button className="ad-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="ad-primary" type="submit">Add Student</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function BulkUploadModal({ type, onClose, setStudents, setCompanies }: { type: 'student' | 'company', onClose: () => void, setStudents?: React.Dispatch<React.SetStateAction<AdminStudent[]>>, setCompanies?: React.Dispatch<React.SetStateAction<AdminCompany[]>> }) {
  const [uploading, setUploading] = useState(false)

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length) return
    setUploading(true)
    setTimeout(() => {
      if (type === 'student' && setStudents) {
        setStudents(prev => [
          { id: Date.now() + 1, name: 'Dummy Student 1', email: 'dummy1@school.edu.ph', status: 'active', applications: 0, joined: 'Just now' },
          { id: Date.now() + 2, name: 'Dummy Student 2', email: 'dummy2@school.edu.ph', status: 'active', applications: 0, joined: 'Just now' },
          ...prev
        ])
      } else if (type === 'company' && setCompanies) {
        setCompanies(prev => [
          { id: Date.now() + 1, name: 'Dummy Company Inc.', industry: 'Various', verification: 'pending', docs: 1, listings: 0, submitted: 'Just now' },
          { id: Date.now() + 2, name: 'Bulk Tech LLC', industry: 'Technology', verification: 'verified', docs: 2, listings: 0, submitted: 'Just now' },
          ...prev
        ])
      }
      setUploading(false)
      onClose()
    }, 1500)
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !uploading) onClose() }}>
      <div className="modal-panel" style={{ width: '400px' }}>
        <div className="modal-header">
          <h3>Add in Bulk</h3>
          <button className="modal-close" onClick={onClose} disabled={uploading} type="button"><X size={16} /></button>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p className="ad-muted" style={{ margin: 0 }}>
            Upload an Excel (`.xlsx`) or CSV file containing a list of {type === 'student' ? 'students' : 'companies'}.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', border: '2px dashed var(--border)', borderRadius: '8px', cursor: uploading ? 'wait' : 'pointer', background: 'var(--bg-subtle)' }}>
            <Upload size={24} style={{ color: 'var(--text-light)', marginBottom: '8px' }} />
            <span style={{ fontWeight: 500 }}>{uploading ? 'Uploading...' : 'Click to select file'}</span>
            {!uploading && <span style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '4px' }}>Supported formats: .xlsx, .csv</span>}
            <input type="file" hidden accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>
    </div>
  )
}
