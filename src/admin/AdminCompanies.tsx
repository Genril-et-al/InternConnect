import { useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle, Plus, Upload, X } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import { BulkUploadModal } from './AdminStudents'
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
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)

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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ad-secondary" onClick={() => setShowBulkModal(true)} type="button" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={14} /> Add in Bulk
          </button>
          <button className="ad-primary" onClick={() => setShowAddModal(true)} type="button" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Company
          </button>
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

      {showAddModal && <AddCompanyModal onClose={() => setShowAddModal(false)} setCompanies={setCompanies} />}
      {showBulkModal && <BulkUploadModal type="company" onClose={() => setShowBulkModal(false)} setCompanies={setCompanies} />}
    </div>
  )
}

function AddCompanyModal({ onClose, setCompanies }: { onClose: () => void, setCompanies: React.Dispatch<React.SetStateAction<AdminCompany[]>> }) {
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !industry) return
    const newCompany: AdminCompany = {
      id: Date.now(),
      name,
      industry,
      verification: 'pending',
      docs: 0,
      listings: 0,
      submitted: 'Just now',
    }
    setCompanies(prev => [newCompany, ...prev])
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" style={{ width: '400px' }}>
        <div className="modal-header">
          <h3>Add New Company</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <label className="cp-modal-label">
            Company Name *
            <input className="ad-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" required />
          </label>
          <label className="cp-modal-label">
            Industry *
            <input className="ad-input" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Technology" required />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button className="ad-secondary" type="button" onClick={onClose}>Cancel</button>
            <button className="ad-primary" type="submit">Add Company</button>
          </div>
        </form>
      </div>
    </div>
  )
}
