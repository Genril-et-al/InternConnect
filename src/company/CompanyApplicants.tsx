import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Link2,
  Search,
  XCircle,
} from 'lucide-react'
import { MATCH_FILTERS } from './companyData'
import type {
  ApplicantStatus,
  CompanyApplicant,
  CompanyListing,
} from './companyData'

/**
 * UC-C04 / UC-C05 — review applications, open an applicant's profile
 * (resume + portfolio), filter by match %, reject with feedback, and send
 * requirement files on acceptance.
 */
export function CompanyApplicants({
  applicants,
  setApplicants,
  listings,
}: {
  applicants: CompanyApplicant[]
  setApplicants: React.Dispatch<React.SetStateAction<CompanyApplicant[]>>
  listings: CompanyListing[]
}) {
  const [search, setSearch] = useState('')
  const [listingFilter, setListingFilter] = useState('All listings')
  const [statusFilter, setStatusFilter] = useState<'All' | ApplicantStatus>('All')
  const [matchFilter, setMatchFilter] = useState('Any match %')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const filtered = useMemo(() => {
    const minMatch = MATCH_FILTERS[matchFilter] ?? 0
    return applicants.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) &&
        (listingFilter === 'All listings' || a.role === listingFilter) &&
        (statusFilter === 'All' || a.status === statusFilter) &&
        a.match >= minMatch,
    )
  }, [applicants, search, listingFilter, statusFilter, matchFilter])

  const selected = applicants.find((a) => a.id === selectedId) ?? null

  if (selected) {
    return (
      <ApplicantDetail
        applicant={selected}
        listings={listings}
        onBack={() => setSelectedId(null)}
        onUpdate={(patch) =>
          setApplicants((prev) =>
            prev.map((a) => (a.id === selected.id ? { ...a, ...patch } : a)),
          )
        }
      />
    )
  }

  return (
    <div className="cp-root">
      <div className="cp-head">
        <div>
          <h1 className="cp-title">Applications</h1>
          <p className="cp-subtitle">
            {applicants.length} total ·{' '}
            {applicants.filter((a) => a.status === 'Pending').length} pending review
          </p>
        </div>
      </div>

      <div className="cp-toolbar">
        <div className="cp-search">
          <Search size={14} />
          <input
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search applicant name…"
            value={search}
          />
        </div>
        <select
          className="cp-select"
          onChange={(e) => setListingFilter(e.target.value)}
          value={listingFilter}
        >
          <option>All listings</option>
          {listings.map((l) => (
            <option key={l.id}>{l.title}</option>
          ))}
        </select>
        <select
          className="cp-select"
          onChange={(e) => setStatusFilter(e.target.value as 'All' | ApplicantStatus)}
          value={statusFilter}
        >
          <option>All</option>
          <option>Pending</option>
          <option>Reviewed</option>
          <option>Accepted</option>
          <option>Rejected</option>
        </select>
        {/* Match percent filter */}
        <select
          className="cp-select"
          onChange={(e) => setMatchFilter(e.target.value)}
          value={matchFilter}
        >
          {Object.keys(MATCH_FILTERS).map((label) => (
            <option key={label}>{label}</option>
          ))}
        </select>
      </div>

      <div className="cp-rows">
        {filtered.length === 0 ? (
          <div className="cp-card cp-empty">No applications match the current filters.</div>
        ) : (
          filtered.map((a) => (
            <button className="cp-row" key={a.id} onClick={() => setSelectedId(a.id)} type="button">
              <span className="cp-row-avatar">{initials(a.name)}</span>
              <div className="cp-row-main">
                <p className="cp-row-name">{a.name}</p>
                <p className="cp-muted">
                  {a.role} · Applied {a.applied}
                </p>
              </div>
              <MatchBar value={a.match} />
              <StatusBadge status={a.status} />
            </button>
          ))
        )}
      </div>
    </div>
  )
}

/* ── Applicant profile detail ─────────────────────────────────────────── */

function ApplicantDetail({
  applicant,
  onBack,
  onUpdate,
  listings
}: {
  applicant: CompanyApplicant
  onBack: () => void
  onUpdate: (patch: Partial<CompanyApplicant>) => void
  listings?: CompanyListing[]
}) {
  const [rejectOpen, setRejectOpen] = useState(false)

  return (
    <div className="cp-root">
      <button className="cp-back" onClick={onBack} type="button">
        <ArrowLeft size={14} /> Back to applications
      </button>

      <section className="cp-card">
        <div className="cp-detail-head">
          <span className="cp-detail-avatar">{initials(applicant.name)}</span>
          <div className="cp-detail-main">
            <h2 className="cp-detail-name">{applicant.name}</h2>
            <p className="cp-muted">
              {applicant.email} · {applicant.role} · Applied {applicant.applied}
            </p>
            <div style={{ marginTop: 8, maxWidth: 220 }}>
              <MatchBar value={applicant.match} />
            </div>
          </div>
          <StatusBadge status={applicant.status} />
        </div>

      <div className="cp-detail-actions" style={{ marginTop: 18 }}>
        {applicant.status !== 'Accepted' && (
          <button 
            className="cp-accept" 
            onClick={() => {
              // Find the corresponding listing to get its requirements
              const listing = listings?.find(l => l.title === applicant.role);
              const submittedRequirements = listing?.requirements?.map(r => ({
                id: r.id,
                name: r.name,
                status: 'Pending' as const
              })) || [];
              
              onUpdate({ status: 'Accepted', submittedRequirements });
            }} 
            type="button"
          >
            <CheckCircle2 size={13} /> Accept
          </button>
        )}
        {applicant.status !== 'Rejected' && applicant.status !== 'Accepted' && (
          <button className="cp-danger" onClick={() => setRejectOpen(true)} type="button">
            <XCircle size={13} /> Reject with feedback
          </button>
        )}
        {applicant.status === 'Pending' && (
          <button
            className="cp-secondary"
            onClick={() => onUpdate({ status: 'Reviewed' })}
            type="button"
          >
            <Eye size={13} /> Mark reviewed
          </button>
        )}
      </div>
    </section>

    {applicant.status === 'Rejected' && applicant.feedback && (
      <p className="cp-notice rejected">
        <strong>Feedback sent to applicant:</strong> {applicant.feedback}
      </p>
    )}

    {applicant.status === 'Accepted' && (
      <section className="cp-card">
        <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: 'var(--brand-brown)' }}>Pre-employment Requirements</h3>
        {(!applicant.submittedRequirements || applicant.submittedRequirements.length === 0) ? (
          <p className="cp-muted">No requirements were set for this listing.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {applicant.submittedRequirements.map((req, idx) => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 500, fontSize: '14px', color: 'var(--text)' }}>{req.name}</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '12px', padding: '2px 8px', borderRadius: '12px', fontWeight: 500,
                      background: req.status === 'Approved' ? 'var(--brand-orange-soft)' : req.status === 'Needs Revision' ? 'var(--brand-crimson)' : 'var(--bg)',
                      color: req.status === 'Approved' ? 'var(--brand-orange)' : req.status === 'Needs Revision' ? 'white' : 'var(--text-light)'
                    }}>
                      {req.status}
                    </span>
                    {req.status === 'Pending' && (
                      <button type="button" onClick={() => downloadDemoFile(req.name, applicant.name)} style={{ background: 'transparent', border: 'none', color: 'var(--brand-orange)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Download size={12} /> View Submission
                      </button>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  {req.status !== 'Approved' && (
                    <button 
                      type="button"
                      onClick={() => {
                        const newReqs = [...applicant.submittedRequirements!];
                        newReqs[idx] = { ...newReqs[idx], status: 'Approved' };
                        onUpdate({ submittedRequirements: newReqs });
                      }}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--brand-orange)', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                    >
                      Approve
                    </button>
                  )}
                  {req.status !== 'Needs Revision' && (
                    <button 
                      type="button"
                      onClick={() => {
                        const newReqs = [...applicant.submittedRequirements!];
                        newReqs[idx] = { ...newReqs[idx], status: 'Needs Revision' };
                        onUpdate({ submittedRequirements: newReqs });
                      }}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                    >
                      Needs Revision
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    )}

      <div className="cp-detail-grid">
        <section className="cp-card">
          <p className="cp-section-label">Skills</p>
          <div className="cp-tags">
            {applicant.skills.map((s) => (
              <span className="cp-tag" key={s}>
                {s}
              </span>
            ))}
          </div>
          <p className="cp-section-label" style={{ marginTop: 16 }}>
            Specializations
          </p>
          <div className="cp-tags">
            {applicant.specializations.map((s) => (
              <span className="cp-tag" key={s}>
                {s}
              </span>
            ))}
          </div>
        </section>

        {/* Resume + portfolio (UC-C04: company must see these) */}
        <section className="cp-card">
          <p className="cp-section-label">Resume / CV</p>
          <div className="cp-doc">
            <FileText size={14} />
            <span className="cp-doc-name">{applicant.resume}</span>
            <button onClick={() => downloadDemoFile(applicant.resume, applicant.name)} type="button">
              <Download size={12} /> Download
            </button>
          </div>

          <p className="cp-section-label" style={{ marginTop: 16 }}>
            Portfolio
          </p>
          {applicant.portfolioLink && (
            <div className="cp-doc">
              <Link2 size={14} />
              <span className="cp-doc-name">{applicant.portfolioLink}</span>
              <a href={applicant.portfolioLink} rel="noreferrer" target="_blank">
                <Eye size={12} /> Open
              </a>
            </div>
          )}
          {applicant.portfolioFile && (
            <div className="cp-doc">
              <FileText size={14} />
              <span className="cp-doc-name">{applicant.portfolioFile}</span>
              <button
                onClick={() => downloadDemoFile(applicant.portfolioFile!, applicant.name)}
                type="button"
              >
                <Download size={12} /> Download
              </button>
            </div>
          )}
          {!applicant.portfolioLink && !applicant.portfolioFile && (
            <p className="cp-muted">No portfolio provided.</p>
          )}
        </section>
      </div>

      <section className="cp-card">
        <p className="cp-section-label">Cover letter</p>
        <p className="cp-cover">{applicant.coverLetter}</p>
      </section>

      {rejectOpen && (
        <RejectModal
          name={applicant.name}
          onClose={() => setRejectOpen(false)}
          onSubmit={(feedback) => {
            onUpdate({ status: 'Rejected', feedback })
            setRejectOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ── Reject with feedback (UC-C05 extension) ─────────────────────────── */

function RejectModal({
  name,
  onClose,
  onSubmit,
}: {
  name: string
  onClose: () => void
  onSubmit: (feedback: string) => void
}) {
  const [feedback, setFeedback] = useState('')

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <h3>Reject with feedback</h3>
          <button className="modal-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>
        <p className="cp-muted">
          Your feedback will be sent to <strong>{name}</strong> along with the rejection
          notification, so they know how to improve.
        </p>
        <label className="cp-modal-label">
          Feedback for the applicant *
          <textarea
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Strong portfolio, but we're looking for more hands-on React experience. Consider contributing to open-source projects…"
            value={feedback}
          />
        </label>
        <div className="cp-modal-footer">
          <button className="cp-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="cp-danger"
            disabled={!feedback.trim()}
            onClick={() => onSubmit(feedback.trim())}
            type="button"
          >
            <XCircle size={13} /> Reject &amp; send feedback
          </button>
        </div>
      </div>
    </div>
  )
}


/* ── Shared bits ─────────────────────────────────────────────────────── */

export function MatchBar({ value }: { value: number }) {
  const color =
    value >= 90
      ? 'var(--brand-orange)'
      : value >= 75
        ? 'var(--brand-orange-soft)'
        : 'var(--brand-brown)'
  return (
    <div className="cp-match">
      <div className="cp-match-track">
        <span style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="cp-match-value" style={{ color }}>
        {value}%
      </span>
    </div>
  )
}

export function StatusBadge({ status }: { status: ApplicantStatus }) {
  const variant =
    status === 'Accepted'
      ? 'success'
      : status === 'Rejected'
        ? 'rejected'
        : status === 'Pending'
          ? 'pending'
          : 'info'
  return <span className={`cp-badge ${variant}`}>{status}</span>
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

/** Demo download — real files come from Supabase Storage later. */
function downloadDemoFile(filename: string, applicant: string) {
  const blob = new Blob(
    [`Demo file placeholder\n\nFile: ${filename}\nApplicant: ${applicant}\n\nReal documents are served from Supabase Storage once connected.`],
    { type: 'text/plain;charset=utf-8' },
  )
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
