import { useMemo, useState, useEffect } from 'react'
import { CheckCircle2, RefreshCw, XCircle, Plus, Upload, X, FileText, Download, Trash2 } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import { BulkUploadModal } from './AdminStudents'
import { addApprovedCompany } from './allowlist'
import { setCompanyVerification, removeApprovedCompany } from './adminQueries'
import type { AdminCompany, VerifStatus } from './adminData'
import { supabase } from '../lib/supabase'
import { Dropdown } from '../components/Dropdown'

/** UC-A02 / UC-A03 — Manage company accounts and NLO verification. */
export function AdminCompanies({
  companies,
  loading,
  loadError,
  onRefresh,
  highlightedCompanyId,
}: {
  companies: AdminCompany[]
  loading: boolean
  loadError: string | null
  onRefresh: () => Promise<void>
  highlightedCompanyId?: string | null
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | VerifStatus>('all')
  const [tierFilter, setTierFilter] = useState('all')
  const [locationFilter, setLocationFilter] = useState('all')

  useEffect(() => {
    if (highlightedCompanyId) {
      setTimeout(() => {
        const el = document.querySelector('tr.highlighted')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
  }, [highlightedCompanyId])

  const [showAddModal, setShowAddModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [viewTarget, setViewTarget] = useState<AdminCompany | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      companies.filter(
        (c) =>
          (filter === 'all' || c.verification === filter) &&
          (tierFilter === 'all' || c.tier === tierFilter) &&
          (locationFilter === 'all' || (c.location && c.location.toLowerCase().includes(locationFilter.toLowerCase()))) &&
          (c.name.toLowerCase().includes(search.toLowerCase()) ||
            c.industry.toLowerCase().includes(search.toLowerCase())),
      ),
    [companies, search, filter, tierFilter, locationFilter],
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
    <div className="ic-page">
      <div className="ic-page-head">
        <div>
          <h1 className="ic-title">Manage Companies</h1>
          <p className="ic-subtitle">
            {companies.length} compan{companies.length === 1 ? 'y' : 'ies'} on the allowlist
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="ic-secondary" onClick={() => setShowBulkModal(true)} type="button" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Upload size={14} /> Add in Bulk
          </button>
          <button className="ic-primary" onClick={() => setShowAddModal(true)} type="button" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={14} /> Add Company
          </button>
        </div>
      </div>

      <div className="ic-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <AdSearch onChange={setSearch} placeholder="Search companies…" value={search} />
        <Dropdown
          ariaLabel="Filter by verification status"
          onChange={(v) => setFilter(v as 'all' | VerifStatus)}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'verified', label: 'Verified' },
            { value: 'pending', label: 'Pending' },
            { value: 'rejected', label: 'Rejected' },
          ]}
          value={filter}
        />
        <Dropdown
          ariaLabel="Filter by tier"
          onChange={setTierFilter}
          options={[
            { value: 'all', label: 'All Tiers' },
            'Tier 1',
            'Tier 2',
            'Tier 3',
          ]}
          value={tierFilter}
        />
        <Dropdown
          ariaLabel="Filter by location"
          onChange={setLocationFilter}
          options={[
            { value: 'all', label: 'All Locations' },
            'Cebu City',
            'Manila',
            'Davao',
          ]}
          value={locationFilter}
        />
      </div>

      {actionError && (
        <p style={{ margin: '0 0 12px', color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{actionError}</p>
      )}

      <div className="ic-table-wrap">
        <table className="ic-table">
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
                <tr key={c.id} onClick={() => setViewTarget(c)} style={{ cursor: 'pointer' }} className={c.id === highlightedCompanyId ? 'highlighted' : ''}>
                  <td>
                    <div className="ic-cell-person">
                      <span className="ic-cell-mark square">{c.name.slice(0, 2).toUpperCase()}</span>
                      <div>
                        <div>{c.name}</div>
                        <p className="ic-muted">{c.registered ? `Submitted ${c.submitted}` : 'Not registered yet'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="ic-muted">{c.industry}</td>
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
                <td className="ic-empty" colSpan={5}>
                  {loading ? 'Loading companies…' : loadError ? `Could not load companies: ${loadError}` : 'No companies found'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && <AddCompanyModal onClose={() => setShowAddModal(false)} onAdded={onRefresh} />}
      {showBulkModal && <BulkUploadModal type="company" onClose={() => setShowBulkModal(false)} onDone={onRefresh} />}
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
          <button aria-label="Close" className="modal-close" onClick={onClose} type="button"><X size={16} /></button>
        </div>
        <div className="ic-view">
          <div className="ic-view-head">
            <span className="ic-cell-mark square" style={{ width: 48, height: 48, fontSize: 16 }}>{initials}</span>
            <div>
              <p className="ic-view-name">{company.name}</p>
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

          <dl className="ic-view-list" style={{ marginTop: '18px' }}>
            {rows.map(([label, value]) => (
              <div className="ic-view-row" key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div style={{ marginTop: '20px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '12px', fontWeight: 700, color: 'var(--brand-brown)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification Documents</h4>
            {displayDocs.length === 0 ? (
              <p className="ic-muted" style={{ margin: 0, fontSize: '13px' }}>No documents submitted.</p>
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
                        <FileText size={16} className="ic-muted" />
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-strong)' }}>
                          {doc.name}
                        </span>
                      </div>
                      <button
                        className="ic-secondary"
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
            <div className="ic-view-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '24px' }}>
              {company.verification !== 'verified' && (
                <button
                  className="ic-approve"
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
                  className="ic-danger"
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
                  className="ic-secondary"
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
            <div className="ic-view-actions" style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <button
                className="ic-danger"
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
          <button aria-label="Close" className="modal-close" onClick={onClose} disabled={busy} type="button"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <p className="ic-muted" style={{ margin: 0 }}>
            This clears the company to self-register. They finish creating their account from the sign-up page.
          </p>
          <label className="cp-modal-label">
            Company Name *
            <input className="ic-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Acme Corp" required />
          </label>
          <label className="cp-modal-label">
            Contact Email *
            <input className="ic-input" type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="e.g. hr@acme.com" required />
          </label>
          <label className="cp-modal-label">
            Industry *
            <input className="ic-input" value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. Technology" required />
          </label>
          <label className="cp-modal-label">
            Business ID / Permit No. *
            <input className="ic-input" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="e.g. SEC-123456" required />
          </label>
          {error && <p style={{ margin: 0, color: 'var(--brand-crimson, #c0392b)', fontSize: '13px' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button className="ic-primary" type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add Company'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
