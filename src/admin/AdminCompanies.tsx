import { useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import type { AdminCompany, VerifStatus } from './adminData'

/** UC-A02 / UC-A03 — Manage company accounts and NLO verification. */
export function AdminCompanies({
  companies,
  setCompanies,
}: {
  companies: AdminCompany[]
  setCompanies: React.Dispatch<React.SetStateAction<AdminCompany[]>>
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | VerifStatus>('all')

  const filtered = useMemo(
    () =>
      companies.filter(
        (c) =>
          (filter === 'all' || c.verification === filter) &&
          (c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.industry.toLowerCase().includes(search.toLowerCase())),
      ),
    [companies, search, filter],
  )

  const setVerif = (id: number, v: VerifStatus) =>
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, verification: v } : c)))

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1 className="ad-title">Manage Companies</h1>
          <p className="ad-subtitle">{companies.length} registered companies</p>
        </div>
      </div>

      <div className="ad-toolbar">
        <AdSearch onChange={setSearch} placeholder="Search companies…" value={search} />
        <select
          className="ad-select"
          onChange={(e) => setFilter(e.target.value as 'all' | VerifStatus)}
          value={filter}
        >
          <option value="all">All Status</option>
          <option value="verified">Verified</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              {['Company', 'Industry', 'Verification', 'Docs', 'Listings', 'Actions'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="ad-cell-person">
                    <span className="ad-cell-mark square">{c.name.slice(0, 2).toUpperCase()}</span>
                    <div>
                      <div>{c.name}</div>
                      <p className="ad-muted">Submitted {c.submitted}</p>
                    </div>
                  </div>
                </td>
                <td className="ad-muted">{c.industry}</td>
                <td>
                  <AdBadge
                    text={
                      c.verification === 'verified'
                        ? 'Verified'
                        : c.verification === 'pending'
                          ? 'Pending'
                          : 'Rejected'
                    }
                    variant={
                      c.verification === 'verified'
                        ? 'success'
                        : c.verification === 'pending'
                          ? 'pending'
                          : 'rejected'
                    }
                  />
                </td>
                <td>{c.docs} docs</td>
                <td>{c.listings}</td>
                <td>
                  <div className="ad-actions" style={{ marginTop: 0 }}>
                    {c.verification !== 'verified' && (
                      <button
                        className="ad-approve"
                        onClick={() => setVerif(c.id, 'verified')}
                        type="button"
                      >
                        <CheckCircle2 size={12} /> Approve
                      </button>
                    )}
                    {c.verification !== 'rejected' && (
                      <button
                        className="ad-danger"
                        onClick={() => setVerif(c.id, 'rejected')}
                        type="button"
                      >
                        <XCircle size={12} /> Reject
                      </button>
                    )}
                    {c.verification === 'rejected' && (
                      <button
                        className="ad-secondary"
                        onClick={() => setVerif(c.id, 'pending')}
                        type="button"
                      >
                        <RefreshCw size={12} /> Reset
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="ad-empty" colSpan={6}>
                  No companies found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
