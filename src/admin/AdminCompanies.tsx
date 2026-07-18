import { useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, XCircle, Plus, Upload, X } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import { BulkUploadModal } from './AdminStudents'
import { addApprovedCompany } from './allowlist'
import { setCompanyVerification } from './adminQueries'
import type { AdminCompany, VerifStatus } from './adminData'

/** UC-A02 / UC-A03 — Manage company accounts and NLO verification. */
export function AdminCompanies({
  companies,
  loading,
  loadError,
  onRefresh,
}: {
  companies: AdminCompany[]
  loading: boolean
  loadError: string | null
  onRefresh: () => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | VerifStatus>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

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

  // Verification is only meaningful once the company has actually registered
  // (has an account row). Allowlisted-but-unregistered companies can't be
  // verified yet — the buttons are hidden for them.
  const setVerif = async (c: AdminCompany, v: VerifStatus) => {
    if (!c.companyId) return
    setBusyId(c.id)
    setActionError(null)
    try {
      await setCompanyVerification(c.companyId, v)
      await onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update verification.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1 className="ad-title">Manage Companies</h1>
          <p className="ad-subtitle">
            {companies.length} compan{companies.length === 1 ? 'y' : 'ies'} on the allowlist
          </p>
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

      {actionError && (
        <p style={{ margin: '0 0 12px', color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{actionError}</p>
      )}

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
            {filtered.map((c) => {
              const busy = busyId === c.id
              return (
                <tr key={c.id}>
                  <td>
                    <div className="ad-cell-person">
                      <span className="ad-cell-mark square">{c.name.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <div>{c.name}</div>
                        <p className="ad-muted">{c.registered ? `Submitted ${c.submitted}` : 'Not registered yet'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="ad-muted">{c.industry}</td>
                  <td>
                    {c.registered ? (
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
                    ) : (
                      <AdBadge text="Awaiting sign-up" variant="neutral" />
                    )}
                  </td>
                  <td>{c.docs} docs</td>
                  <td>{c.listings}</td>
                  <td>
                    {c.registered ? (
                      <div className="ad-actions" style={{ marginTop: 0 }}>
                        {c.verification !== 'verified' && (
                          <button className="ad-approve" onClick={() => setVerif(c, 'verified')} type="button" disabled={busy}>
                            <CheckCircle2 size={12} /> Approve
                          </button>
                        )}
                        {c.verification !== 'rejected' && (
                          <button className="ad-danger" onClick={() => setVerif(c, 'rejected')} type="button" disabled={busy}>
                            <XCircle size={12} /> Reject
                          </button>
                        )}
                        {c.verification === 'rejected' && (
                          <button className="ad-secondary" onClick={() => setVerif(c, 'pending')} type="button" disabled={busy}>
                            <RefreshCw size={12} /> Reset
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="ad-muted">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="ad-empty" colSpan={6}>
                  {loading ? 'Loading companies…' : loadError ? `Could not load companies: ${loadError}` : 'No companies found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddCompanyModal onClose={() => setShowAddModal(false)} onAdded={onRefresh} />}
      {showBulkModal && <BulkUploadModal type="company" onClose={() => setShowBulkModal(false)} onDone={onRefresh} />}
    </div>
  )
}

function AddCompanyModal({ onClose, onAdded }: { onClose: () => void, onAdded: () => Promise<void> }) {
  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !contactEmail || busy) return
    setBusy(true)
    setError(null)
    try {
      // Pre-clears the company's contact email so it can self-register (UC-A03).
      await addApprovedCompany({ companyName: name, contactEmail, identifier })
      await onAdded() // reload from the allowlist so the new row shows accurately
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the company.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="modal-panel" style={{ width: '400px' }}>
        <div className="modal-header">
          <h3>Add New Company</h3>
          <button className="modal-close" onClick={onClose} disabled={busy} type="button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <p className="ad-muted" style={{ margin: 0 }}>
            This clears the company to self-register. They finish creating their account from the sign-up page.
          </p>
          <label className="cp-modal-label">
            Company Name *
            <input className="ad-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" required />
          </label>
          <label className="cp-modal-label">
            Contact Email *
            <input className="ad-input" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="e.g. hr@acme.com" required />
          </label>
          <label className="cp-modal-label">
            Industry
            <input className="ad-input" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Technology (optional)" />
          </label>
          <label className="cp-modal-label">
            Business ID / Permit No.
            <input className="ad-input" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="e.g. SEC-123456 (optional)" />
          </label>
          {error && <p style={{ margin: 0, color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button className="ad-secondary" type="button" onClick={onClose} disabled={busy}>Cancel</button>
            <button className="ad-primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add Company'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
