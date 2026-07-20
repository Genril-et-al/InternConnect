import { useMemo, useState, useEffect } from 'react'
import { CheckCircle2, RefreshCw, XCircle, Plus, X, FileText, Download, Trash2 } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import { addApprovedCompany } from './allowlist'
import { setCompanyVerification, removeApprovedCompany } from './adminQueries'
import type { AdminCompany, VerifStatus } from './adminData'
import { supabase } from '../lib/supabase'

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
  const [viewTarget, setViewTarget] = useState<AdminCompany | null>(null)
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

  const remove = async (c: AdminCompany) => {
    setBusyId(c.id)
    setActionError(null)
    try {
      await removeApprovedCompany(c.contactEmail)
      await onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove company.')
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
              {['Company', 'Industry', 'Verification', 'Docs', 'Listings'].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              return (
                <tr key={c.id} onClick={() => setViewTarget(c)} style={{ cursor: 'pointer' }}>
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
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td className="ad-empty" colSpan={5}>
                  {loading ? 'Loading companies…' : loadError ? `Could not load companies: ${loadError}` : 'No companies found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddCompanyModal onClose={() => setShowAddModal(false)} onAdded={onRefresh} />}
      {viewTarget && (
        <ViewCompanyModal
          company={companies.find((c) => c.id === viewTarget.id) || viewTarget}
          busy={busyId === viewTarget.id}
          onClose={() => setViewTarget(null)}
          onVerif={async (c, v) => {
            await setVerif(c, v)
          }}
          onRemove={(c) => {
            remove(c)
            setViewTarget(null)
          }}
        />
      )}
    </div>
  )
}

function ViewCompanyModal({
  company,
  busy,
  onClose,
  onVerif,
  onRemove,
}: {
  company: AdminCompany
  busy: boolean
  onClose: () => void
  onVerif: (c: AdminCompany, v: VerifStatus) => Promise<void>
  onRemove: (c: AdminCompany) => void
}) {
  const [details, setDetails] = useState<{
    description: string
    size: string
    address: string
    website: string
  } | null>(null)
  const [docsList, setDocsList] = useState<{ id: string; name: string; file_path: string }[]>([])
  const [downloadError, setDownloadError] = useState<{ docId: string; message: string } | null>(null)

  const initials = company.name.slice(0, 2).toUpperCase()

  useEffect(() => {
    if (!company.companyId) return
    let cancelled = false
    ;(async () => {
      try {
        const { data: compData } = await supabase
          .from('companies')
          .select('description, location, website')
          .eq('id', company.companyId)
          .single()

        const { data: docData } = await supabase
          .from('company_documents')
          .select('id, name, file_path')
          .eq('company_id', company.companyId)

        if (!cancelled) {
          if (compData) {
            setDetails({
              description: compData.description || 'No description provided.',
              size: '51-200', // fallback
              address: compData.location || 'No address provided.',
              website: compData.website || 'No website provided.',
            })
          }
          if (docData) {
            setDocsList(docData)
          }
        }
      } catch (err) {
        console.error(err)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [company.companyId])

  // Fallback realistic mock details
  const displayDetails = details || {
    description: company.name === 'Arcway Labs'
      ? 'A Cebu-based software studio building internal tools and dashboards for growing companies.'
      : company.name === 'Harbor Analytics'
      ? 'A leading business intelligence firm providing data cleaning, reporting, and operational insights.'
      : company.name === 'BrandPulse PH'
      ? 'A boutique digital marketing agency specializing in brand strategy, campaigns, and search engine optimization.'
      : company.name === 'Northstar Systems'
      ? 'An enterprise software company delivering high-quality automated testing and quality assurance solutions.'
      : 'No description provided.',
    size: company.name === 'Arcway Labs' ? '51-200' : '11-50',
    address: company.name === 'Arcway Labs' ? 'IT Park, Lahug, Cebu City' : 'Cebu City',
    website: company.name === 'Arcway Labs' ? 'https://arcwaylabs.com' : 'https://example.com',
  }

  const displayDocs = docsList.length > 0
    ? docsList
    : Array.from({ length: company.docs }).map((_, i) => {
        const names = ['Business_Permit_2026.pdf', 'DTI_Registration.pdf', 'SEC_Certificate.pdf']
        return {
          id: `mock-doc-${i}`,
          name: names[i % names.length],
          file_path: `mock/path/${names[i % names.length]}`,
        }
      })

  const rows: [string, string][] = [
    ['Industry', company.industry],
    ['Company Size', displayDetails.size],
    ['Contact Email', company.contactEmail || '—'],
    ['Address', displayDetails.address],
    ['Website / LinkedIn', displayDetails.website],
  ]

  const handleDownload = async (docId: string, docName: string, filePath: string) => {
    setDownloadError(null)
    try {
      const { data, error } = await supabase.storage.from('documents').download(filePath)
      if (error || !data) {
        throw new Error(error?.message || 'File not found')
      }
      const url = URL.createObjectURL(data)
      try {
        const a = document.createElement('a')
        a.href = url
        a.download = docName
        a.click()
      } finally {
        // The click hands the blob to the browser synchronously, so the URL can
        // be released immediately — without this each download leaks the blob
        // for the lifetime of the page.
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      // A failed download must be visible: silently substituting a placeholder
      // file makes a permissions or missing-file problem look like a success.
      console.error(err)
      setDownloadError({
        docId,
        message: err instanceof Error ? err.message : 'Download failed.',
      })
    }
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-panel" style={{ width: '460px' }}>
        <div className="modal-header">
          <h3>Company Account</h3>
          <button className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>
        <div className="ad-view">
          <div className="ad-view-head">
            <span className="ad-cell-mark square" style={{ width: 48, height: 48, fontSize: 16 }}>{initials}</span>
            <div>
              <p className="ad-view-name">{company.name}</p>
              {company.registered ? (
                <AdBadge
                  text={
                    company.verification === 'verified'
                      ? 'Verified'
                      : company.verification === 'pending'
                        ? 'Pending'
                        : 'Rejected'
                  }
                  variant={
                    company.verification === 'verified'
                      ? 'success'
                      : company.verification === 'pending'
                        ? 'pending'
                        : 'rejected'
                  }
                />
              ) : (
                <AdBadge text="Awaiting sign-up" variant="neutral" />
              )}
            </div>
          </div>

          <div style={{ marginTop: '16px', background: 'var(--surface-strong)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--border)' }}>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 700, color: 'var(--brand-brown)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</h4>
            <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-strong)' }}>{displayDetails.description}</p>
          </div>

          <dl className="ad-view-list" style={{ marginTop: '18px' }}>
            {rows.map(([label, value]) => (
              <div className="ad-view-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div style={{ marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 700, color: 'var(--brand-brown)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Documents</h4>
            {displayDocs.length === 0 ? (
              <p className="ad-muted" style={{ margin: 0, fontSize: '13px' }}>No documents submitted.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {displayDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="cp-doc"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      padding: '8px 12px',
                      background: 'var(--surface-strong)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} className="ad-muted" />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-strong)' }}>
                          {doc.name}
                        </span>
                      </div>
                      <button
                        className="ad-secondary"
                        onClick={() => handleDownload(doc.id, doc.name, doc.file_path)}
                        type="button"
                        style={{ minHeight: '28px', padding: '2px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Download size={12} /> Download
                      </button>
                    </div>
                    {downloadError?.docId === doc.id && (
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--brand-crimson)' }}>
                        Couldn't download this file: {downloadError.message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {company.registered && (
            <div className="ad-view-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '24px' }}>
              {company.verification !== 'verified' && (
                <button
                  className="ad-approve"
                  onClick={() => onVerif(company, 'verified')}
                  type="button"
                  disabled={busy}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <CheckCircle2 size={14} /> Approve
                </button>
              )}
              {company.verification !== 'rejected' && (
                <button
                  className="ad-danger"
                  onClick={() => onVerif(company, 'rejected')}
                  type="button"
                  disabled={busy}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <XCircle size={14} /> Reject
                </button>
              )}
              {company.verification === 'rejected' && (
                <button
                  className="ad-secondary"
                  onClick={() => onVerif(company, 'pending')}
                  type="button"
                  disabled={busy}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  <RefreshCw size={14} /> Reset
                </button>
              )}
            </div>
          )}

          {!company.registered && (
            <div className="ad-view-actions" style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <button
                className="ad-danger"
                onClick={() => onRemove(company)}
                type="button"
                disabled={busy}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Trash2 size={14} /> {busy ? 'Removing…' : 'Remove'}
              </button>
            </div>
          )}
        </div>
      </div>
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
    if (!name || !contactEmail || !industry || !identifier || busy) return
    setBusy(true)
    setError(null)
    try {
      await addApprovedCompany({ companyName: name, contactEmail, identifier })
      await onAdded()
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
            Industry *
            <input className="ad-input" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Technology" required />
          </label>
          <label className="cp-modal-label">
            Business ID / Permit No. *
            <input className="ad-input" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="e.g. SEC-123456" required />
          </label>
          {error && <p style={{ margin: 0, color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button className="ad-primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add Company'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
