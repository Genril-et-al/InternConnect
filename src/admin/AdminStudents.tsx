import { useMemo, useState } from 'react'
import { UserCheck, UserX } from 'lucide-react'
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
    </div>
  )
}
