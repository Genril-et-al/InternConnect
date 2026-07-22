import { useMemo, useState, useEffect } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Link2,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import { MATCH_FILTERS } from './companyData'
import type {
  ApplicantStatus,
  CompanyApplicant,
  CompanyListing,
} from './companyData'
import { signedDocumentUrl } from '../lib/profile'
import type { InterviewDetails } from './companyQueries'
import { Dropdown } from '../components/Dropdown'
import { useScrollLock } from '../lib/useScrollLock'

/**
 * UC-C04 / UC-C05 — review applications, open an applicant's profile
 * (resume + portfolio), filter by match %, reject with feedback, and send
 * requirement files on acceptance.
 */
export function CompanyApplicants({
  applicants,
  listings,
  onSetStatus,
  onBulkReject,
  onScheduleInterview,
  onReviewSubmission,
  highlightedApplicantId,
}: {
  applicants: CompanyApplicant[]
  listings: CompanyListing[]
  onSetStatus: (id: string, status: ApplicantStatus, feedback?: string) => Promise<void>
  onBulkReject?: (rejections: { id: string; feedback: string }[]) => Promise<void>
  onScheduleInterview: (id: string, details: InterviewDetails) => Promise<void>
  onReviewSubmission: (submissionId: string, applicationId: string, approve: boolean, feedback?: string) => Promise<void>
  highlightedApplicantId?: string | null
}) {
  const [search, setSearch] = useState('')
  const [listingFilter, setListingFilter] = useState('All listings')
  const [statusFilter, setStatusFilter] = useState<'All' | ApplicantStatus>('All')
  const [matchFilter, setMatchFilter] = useState('Any match %')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Smart default expansion
  const [expandedListings, setExpandedListings] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    listings.forEach(l => {
      const needsAttention = applicants.some(a => a.role === l.title && (a.status === 'Pending' || a.status === 'Interview Scheduled' || a.status === 'Under Review'))
      if (needsAttention) initial.add(l.id)
    })
    return initial
  })

  useEffect(() => {
    if (highlightedApplicantId) {
      setTimeout(() => {
        const el = document.querySelector('.cp-row.highlighted')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
  }, [highlightedApplicantId])

  const filteredApplicants = useMemo(() => {
    const minMatch = MATCH_FILTERS[matchFilter] ?? 0
    return applicants.filter(
      (a) =>
        a.name.toLowerCase().includes(search.toLowerCase()) &&
        (listingFilter === 'All listings' || a.role === listingFilter) &&
        (statusFilter === 'All' || a.status === statusFilter) &&
        (a.match === null ? minMatch === 0 : a.match >= minMatch),
    )
  }, [applicants, search, listingFilter, statusFilter, matchFilter])

  const visibleListings = useMemo(() => {
    return listings.filter(l => {
      if (listingFilter !== 'All listings' && l.title !== listingFilter) return false
      return filteredApplicants.some(a => a.role === l.title)
    })
  }, [listings, listingFilter, filteredApplicants])

  const selected = applicants.find((a) => a.id === selectedId) ?? null

  if (selected) {
    return (
      <ApplicantDetail
        applicant={selected}
        listings={listings}
        onBack={() => setSelectedId(null)}
        onSetStatus={onSetStatus}
        onScheduleInterview={onScheduleInterview}
        onReviewSubmission={onReviewSubmission}
      />
    )
  }

  return (
    <div className="cp-root">
      <div className="cp-head">
        <div>
          <h1 className="cp-title">Applications</h1>
          <p className="cp-subtitle">
            {applicants.length} total · {applicants.filter((a) => a.status === 'Pending').length} pending review
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
        <Dropdown
          ariaLabel="Filter by listing"
          onChange={setListingFilter}
          options={['All listings', ...listings.map((l) => l.title)]}
          value={listingFilter}
        />
        <Dropdown
          ariaLabel="Filter by status"
          onChange={(v) => setStatusFilter(v as 'All' | ApplicantStatus)}
          options={['All', 'Pending', 'Reviewed', 'Accepted', 'Rejected']}
          value={statusFilter}
        />
        <Dropdown
          ariaLabel="Filter by match percentage"
          onChange={setMatchFilter}
          options={Object.keys(MATCH_FILTERS)}
          value={matchFilter}
        />
      </div>

      <div className="cp-rows" style={{ gap: '16px' }}>
        {visibleListings.length === 0 ? (
          <div className="cp-card cp-empty">No applications match the current filters.</div>
        ) : (
          visibleListings.map(listing => {
            const listingApplicants = filteredApplicants.filter(a => a.role === listing.title)
            const allListingApplicants = applicants.filter(a => a.role === listing.title)
            return (
              <ListingGroupCard
                key={listing.id}
                listing={listing}
                applicants={listingApplicants}
                allApplicants={allListingApplicants}
                isExpanded={expandedListings.has(listing.id)}
                onToggleExpand={() => {
                  const next = new Set(expandedListings)
                  if (next.has(listing.id)) next.delete(listing.id)
                  else next.add(listing.id)
                  setExpandedListings(next)
                }}
                onSelectApplicant={setSelectedId}
                highlightedApplicantId={highlightedApplicantId}
                onBulkReject={onBulkReject}
              />
            )
          })
        )}
      </div>
    </div>
  )
}

function ListingGroupCard({
  listing,
  applicants,
  allApplicants,
  isExpanded,
  onToggleExpand,
  onSelectApplicant,
  highlightedApplicantId,
  onBulkReject
}: {
  listing: CompanyListing
  applicants: CompanyApplicant[]
  allApplicants: CompanyApplicant[]
  isExpanded: boolean
  onToggleExpand: () => void
  onSelectApplicant: (id: string) => void
  highlightedApplicantId?: string | null
  onBulkReject?: (rejections: { id: string; feedback: string }[]) => Promise<void>
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false)
  const [closeHiringOpen, setCloseHiringOpen] = useState(false)

  const pendingCount = allApplicants.filter(a => a.status === 'Pending').length
  const reviewCount = allApplicants.filter(a => a.status === 'Under Review').length
  const interviewCount = allApplicants.filter(a => a.status === 'Interview Scheduled').length
  const acceptedCount = allApplicants.filter(a => a.status === 'Accepted').length
  const rejectedCount = allApplicants.filter(a => a.status === 'Rejected').length

  const isFull = acceptedCount >= listing.slots

  const handleSelectAllPending = () => {
    setSelectedIds(new Set(applicants.filter(a => a.status === 'Pending').map(a => a.id)))
  }
  const handleSelectInterviewed = () => {
    setSelectedIds(new Set(applicants.filter(a => a.status === 'Interview Scheduled').map(a => a.id)))
  }
  const handleSelectAll = () => {
    setSelectedIds(new Set(applicants.map(a => a.id)))
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(113,66,54,0.06)' }}>
      <div onClick={onToggleExpand} style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-subtle)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
             <h3 style={{ margin: 0, color: 'var(--text-strong)', fontSize: '18px' }}>{listing.title}</h3>
             {isFull && <span style={{ background: 'var(--brand-crimson)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>Quota Reached</span>}
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '13px', color: 'var(--text-light)', alignItems: 'center' }}>
            <span style={{ color: isFull ? 'var(--brand-crimson)' : 'inherit', fontWeight: isFull ? 600 : 400 }}>
              {acceptedCount} of {listing.slots} positions filled
            </span>
            <span>{allApplicants.length} total applicants</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {pendingCount > 0 && <span style={{ background: '#FFF8E1', color: '#F57F17', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>🟡 Pending ({pendingCount})</span>}
              {reviewCount > 0 && <span style={{ background: '#E3F2FD', color: '#1976D2', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>🔵 Review ({reviewCount})</span>}
              {interviewCount > 0 && <span style={{ background: '#E3F2FD', color: '#1976D2', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>🔵 Interview ({interviewCount})</span>}
              {acceptedCount > 0 && <span style={{ background: '#E8F5E9', color: '#388E3C', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>🟢 Accepted ({acceptedCount})</span>}
              {rejectedCount > 0 && <span style={{ background: '#FFEBEE', color: '#D32F2F', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>🔴 Rejected ({rejectedCount})</span>}
            </div>
          </div>
        </div>
        <div style={{ color: 'var(--text-light)', paddingLeft: '16px' }}>
          {isExpanded ? <X size={20} /> : <span style={{fontSize: '20px', fontWeight: 'bold'}}>+</span>}
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)' }}>
          {isFull && pendingCount > 0 && (
            <div style={{ background: '#FFEBEE', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #ffcdd2' }}>
              <span style={{ color: '#D32F2F', fontWeight: 600 }}>Hiring quota reached ({acceptedCount} of {listing.slots} positions filled).</span>
              <button onClick={() => setCloseHiringOpen(true)} style={{ background: '#D32F2F', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Close Hiring</button>
            </div>
          )}

          <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '13px' }}>
            <span style={{ cursor: 'pointer', color: 'var(--brand-brown)', fontWeight: 600, textDecoration: 'underline' }} onClick={handleSelectAllPending}>Select All Pending</span>
            <span style={{ cursor: 'pointer', color: 'var(--brand-brown)', fontWeight: 600, textDecoration: 'underline' }} onClick={handleSelectInterviewed}>Select Interviewed</span>
            <span style={{ cursor: 'pointer', color: 'var(--brand-brown)', fontWeight: 600, textDecoration: 'underline' }} onClick={handleSelectAll}>Select All</span>
          </div>

          <div className="cp-rows" style={{ gap: '8px' }}>
            {applicants.map(a => (
              <div className={`cp-row ${a.id === highlightedApplicantId ? 'highlighted' : ''}`} key={a.id} style={{ padding: 0, overflow: 'hidden', borderRadius: '8px', boxShadow: 'none', border: '1px solid var(--border-light, #eee)' }}>
                <div style={{ padding: '0 0 0 16px', display: 'flex', alignItems: 'center' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.has(a.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedIds)
                      if (e.target.checked) newSet.add(a.id)
                      else newSet.delete(a.id)
                      setSelectedIds(newSet)
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--brand-orange)', margin: 0 }}
                  />
                </div>
                <button 
                  onClick={() => onSelectApplicant(a.id)} 
                  type="button" 
                  style={{ flex: 1, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', background: 'transparent', border: 'none', padding: '12px 16px', cursor: 'pointer', textAlign: 'left', minWidth: 0, outline: 'none' }}
                >
                  <span className="cp-row-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{initials(a.name)}</span>
                  <div className="cp-row-main">
                    <p className="cp-row-name" style={{ fontSize: '14px' }}>{a.name}</p>
                    <p className="cp-muted" style={{ fontSize: '12px' }}>
                      Applied {a.applied}
                    </p>
                  </div>
                  <MatchBar value={a.match} />
                  <StatusBadge status={a.status} />
                </button>
              </div>
            ))}
            {applicants.length === 0 && (
              <p className="cp-muted" style={{ margin: 0 }}>No applicants match current filters.</p>
            )}
          </div>

          {selectedIds.size > 0 && (
            <div style={{ marginTop: '16px', background: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 600, color: 'var(--brand-brown)' }}>{selectedIds.size} applicant{selectedIds.size > 1 ? 's' : ''} selected</span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setSelectedIds(new Set())} style={{ background: 'transparent', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                <button type="button" onClick={() => setBulkRejectOpen(true)} style={{ background: 'var(--brand-crimson)', color: 'white', border: 'none', borderRadius: '6px', padding: '6px 16px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>Reject Selected</button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Modals rendered here so they overlay properly */}
      {bulkRejectOpen && onBulkReject && (
        <BulkRejectModal 
          count={selectedIds.size}
          onClose={() => setBulkRejectOpen(false)}
          onSubmit={async (template) => {
            const rejections = Array.from(selectedIds).map(id => {
              const app = applicants.find(a => a.id === id)
              return {
                id,
                feedback: template.replace('{Applicant Name}', app?.name ?? 'Applicant')
              }
            })
            await onBulkReject(rejections)
            setBulkRejectOpen(false)
            setSelectedIds(new Set())
          }}
        />
      )}

      {closeHiringOpen && onBulkReject && (
        <AutoRejectModal
          info={{ listing, count: pendingCount, pendingIds: allApplicants.filter(a => a.status === 'Pending').map(a => a.id) }}
          onClose={() => setCloseHiringOpen(false)}
          onSubmit={async (template) => {
            const pendingApps = allApplicants.filter(a => a.status === 'Pending')
            const rejections = pendingApps.map(app => ({
              id: app.id,
              feedback: template.replace('{Applicant Name}', app.name)
            }))
            await onBulkReject(rejections)
            setCloseHiringOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ── Applicant profile detail ─────────────────────────────────────────── */

function ApplicantDetail({
  applicant,
  listings,
  onBack,
  onSetStatus,
  onScheduleInterview,
  onReviewSubmission,
}: {
  applicant: CompanyApplicant
  listings: CompanyListing[]
  onBack: () => void
  onSetStatus: (id: string, status: ApplicantStatus, feedback?: string) => Promise<void>
  onScheduleInterview: (id: string, details: InterviewDetails) => Promise<void>
  onReviewSubmission: (submissionId: string, applicationId: string, approve: boolean, feedback?: string) => Promise<void>
}) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const [scheduleInterviewOpen, setScheduleInterviewOpen] = useState(false)
  const [nextRoundName, setNextRoundName] = useState<string>('Interview')
  const [revisionOpen, setRevisionOpen] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewDownloadUrl, setPreviewDownloadUrl] = useState<string | null>(null)
  const [previewName, setPreviewName] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // This view isn't itself a modal — it's the applicant page — so the lock
  // belongs to the document preview it can open over itself.
  useScrollLock(previewUrl !== null)

  const handleOpenDocument = async (path: string, name?: string) => {
    try {
      setPreviewLoading(true)
      const pUrl = await signedDocumentUrl(path)
      const dUrl = await signedDocumentUrl(path, name)
      setPreviewUrl(pUrl)
      setPreviewDownloadUrl(dUrl)
      setPreviewName(name ?? 'Document Preview')
    } catch {
      window.alert('Could not open the document. Please try again.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const run = (action: () => Promise<void>) => {
    setActionError(null)
    action().catch((err) => setActionError(err instanceof Error ? err.message : 'Action failed.'))
  }

  return (
    <div className="cp-root">
      <button className="detail-back" onClick={onBack} type="button">
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
        {applicant.status === 'Interview Scheduled' && (
          <>
            <button
              className="cp-accept"
              onClick={() => run(() => onSetStatus(applicant.id, 'Accepted'))}
              type="button"
            >
              <CheckCircle2 size={13} /> Finalize Acceptance
            </button>
            {(() => {
              // Find if there is a next round based on listing's process
              const rounds = listings.find((l) => l.title === applicant.role)?.interviewProcess?.rounds ?? ['Interview']
              let currentRoundIdx = -1
              try {
                const details = JSON.parse(applicant.nextStep)
                if (details.roundName) {
                  currentRoundIdx = rounds.indexOf(details.roundName)
                }
              } catch {}
              
              if (currentRoundIdx >= 0 && currentRoundIdx + 1 < rounds.length) {
                return (
                  <button
                    className="cp-secondary"
                    onClick={() => {
                      setNextRoundName(rounds[currentRoundIdx + 1])
                      setScheduleInterviewOpen(true)
                    }}
                    type="button"
                  >
                    <CheckCircle2 size={13} /> Schedule Next Round
                  </button>
                )
              }
              return null
            })()}
            <button className="cp-danger" onClick={() => setRejectOpen(true)} type="button">
              <XCircle size={13} /> Fail Interview
            </button>
          </>
        )}
        {applicant.status !== 'Accepted' && applicant.status !== 'Rejected' && applicant.status !== 'Interview Scheduled' && (
          <button
            className="cp-accept"
            onClick={() => {
              const rounds = listings.find((l) => l.title === applicant.role)?.interviewProcess?.rounds ?? ['Interview']
              if (rounds.length === 0) {
                run(() => onSetStatus(applicant.id, 'Accepted'))
              } else {
                setNextRoundName(rounds[0])
                setScheduleInterviewOpen(true)
              }
            }}
            type="button"
          >
            <CheckCircle2 size={13} /> Accept
          </button>
        )}
        {applicant.status !== 'Rejected' && applicant.status !== 'Accepted' && applicant.status !== 'Interview Scheduled' && (
          <button className="cp-danger" onClick={() => setRejectOpen(true)} type="button">
            <XCircle size={13} /> Reject
          </button>
        )}
        {applicant.status === 'Pending' && (
          <button
            className="cp-secondary"
            onClick={() => run(() => onSetStatus(applicant.id, 'Reviewed'))}
            type="button"
          >
            <Eye size={13} /> Mark reviewed
          </button>
        )}
      </div>
      {actionError && <p className="cp-notice rejected" style={{ marginTop: 12 }}>{actionError}</p>}
    </section>

    {applicant.status === 'Rejected' && applicant.feedback && (
      <p className="cp-notice rejected">
        <strong>Feedback sent to applicant:</strong> {applicant.feedback}
      </p>
    )}

    {applicant.status === 'Interview Scheduled' && applicant.nextStep && (
      <section className="cp-card">
        <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: 'var(--brand-brown)' }}>Interview Details</h3>
        <div style={{ fontSize: '14px', color: 'var(--text)' }}>
          {(() => {
            try {
              const details = JSON.parse(applicant.nextStep)
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '8px' }}>
                  {details.roundName && (
                    <>
                      <strong style={{ color: 'var(--brand-brown)' }}>Round:</strong> <span>{details.roundName}</span>
                    </>
                  )}
                  <strong style={{ color: 'var(--brand-brown)' }}>Date:</strong> <span>{details.date}</span>
                  <strong style={{ color: 'var(--brand-brown)' }}>Time:</strong> <span>{details.time}</span>
                  <strong style={{ color: 'var(--brand-brown)' }}>Mode:</strong> <span style={{ textTransform: 'capitalize' }}>{details.mode}</span>
                  <strong style={{ color: 'var(--brand-brown)' }}>Location/Link:</strong> <span>{details.mode === 'online' ? <a href={details.locationOrLink} target="_blank" rel="noreferrer" style={{ color: 'var(--brand-orange)' }}>{details.locationOrLink}</a> : details.locationOrLink}</span>
                </div>
              )
            } catch {
              return <p>{applicant.nextStep}</p>
            }
          })()}
        </div>
      </section>
    )}

    {applicant.status === 'Accepted' && (
      <section className="cp-card">
        <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: 'var(--brand-brown)' }}>Pre-employment Requirements</h3>
        {(!applicant.submittedRequirements || applicant.submittedRequirements.length === 0) ? (
          <p className="cp-muted">No requirements were set for this listing.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {applicant.submittedRequirements.map((req) => (
              <div key={req.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--bg-subtle)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontWeight: 500, fontSize: '14px', color: 'var(--text)' }}>{req.name}</p>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ 
                      fontSize: '12px', padding: '2px 8px', borderRadius: '12px', fontWeight: 500,
                      background: req.status === 'Approved' ? 'rgba(46, 160, 67, 0.15)' : req.status === 'Needs Revision' ? 'var(--brand-crimson)' : 'var(--bg)',
                      color: req.status === 'Approved' ? '#3fb950' : req.status === 'Needs Revision' ? 'white' : 'var(--text-light)'
                    }}>
                      {req.status}
                    </span>
                    {req.fileUrl && (
                      <button type="button" disabled={previewLoading} onClick={() => handleOpenDocument(req.fileUrl!, req.name)} style={{ background: 'transparent', border: 'none', color: 'var(--brand-orange)', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Download size={12} /> {previewLoading ? 'Loading...' : 'View Submission'}
                      </button>
                    )}
                  </div>
                  {req.status === 'Needs Revision' && req.feedback && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'var(--brand-crimson)' }}>
                      <strong>Reason:</strong> {req.feedback}
                    </p>
                  )}
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  {req.submissionId ? (
                    <>
                      {req.status !== 'Approved' && (
                        <button
                          type="button"
                          onClick={() => run(() => onReviewSubmission(req.submissionId!, applicant.id, true))}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--brand-orange)', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Approve
                        </button>
                      )}
                      {req.status !== 'Needs Revision' && (
                        <button
                          type="button"
                          onClick={() => setRevisionOpen(req.submissionId!)}
                          style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontSize: '12px', fontWeight: 500 }}
                        >
                          Needs Revision
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="cp-muted" style={{ fontSize: '12px' }}>Awaiting submission</span>
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
          {applicant.resume ? (
            <div className="cp-doc">
              <FileText size={14} />
              <span className="cp-doc-name">{docLabel(applicant.resume, applicant.name, 'Resume')}</span>
              <button
                onClick={() => handleOpenDocument(applicant.resume!, docLabel(applicant.resume!, applicant.name, 'Resume'))}
                type="button"
                disabled={previewLoading}
              >
                <Download size={12} /> View
              </button>
            </div>
          ) : (
            <p className="cp-muted">No resume uploaded.</p>
          )}

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
              <span className="cp-doc-name">
                {docLabel(applicant.portfolioFile, applicant.name, 'Portfolio')}
              </span>
              <button
                onClick={() => handleOpenDocument(applicant.portfolioFile!, docLabel(applicant.portfolioFile!, applicant.name, 'Portfolio'))}
                type="button"
                disabled={previewLoading}
              >
                <Download size={12} /> View
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
        {applicant.coverLetterFile ? (
          <div className="cp-doc">
            <FileText size={14} />
            <span className="cp-doc-name">
              {docLabel(applicant.coverLetterFile, applicant.name, 'Cover Letter')}
            </span>
            <button
              onClick={() => handleOpenDocument(applicant.coverLetterFile!, docLabel(applicant.coverLetterFile!, applicant.name, 'Cover Letter'))}
              type="button"
              disabled={previewLoading}
            >
              <Download size={12} /> View
            </button>
          </div>
        ) : (
          <p className="cp-muted">No cover letter uploaded.</p>
        )}
      </section>

      {rejectOpen && (
        <RejectModal
          name={applicant.name}
          onClose={() => setRejectOpen(false)}
          onSubmit={(feedback) => {
            run(() => onSetStatus(applicant.id, 'Rejected', feedback))
            setRejectOpen(false)
          }}
        />
      )}

      {scheduleInterviewOpen && (
        <ScheduleInterviewModal
          roundName={nextRoundName}
          onClose={() => setScheduleInterviewOpen(false)}
          onSubmit={(details) => {
            run(() => onScheduleInterview(applicant.id, details))
            setScheduleInterviewOpen(false)
          }}
          onSkip={() => {
            run(() => onSetStatus(applicant.id, 'Accepted'))
            setScheduleInterviewOpen(false)
          }}
        />
      )}

      {previewUrl && (
        <div 
          className="modal-overlay" 
          onClick={() => setPreviewUrl(null)} 
          style={{ zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '40px' }}
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            style={{ display: 'flex', flexDirection: 'column', background: 'white', flex: 1, borderRadius: '8px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--brand-brown)' }}>{previewName}</h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <a href={previewUrl} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--brand-orange)', textDecoration: 'none' }}>
                  <Eye size={14} /> Open in new tab
                </a>
                <button onClick={() => setPreviewUrl(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-light)' }} type="button">
                  <XCircle size={20} />
                </button>
              </div>
            </div>
            <iframe 
              src={previewUrl} 
              style={{ flex: 1, width: '100%', border: 'none', background: '#f9fafb' }} 
              title={previewName}
            />
          </div>
        </div>
      )}

      {revisionOpen && (
        <RevisionModal
          onClose={() => setRevisionOpen(null)}
          onSubmit={(reason) => {
            run(() => onReviewSubmission(revisionOpen, applicant.id, false, reason))
            setRevisionOpen(null)
          }}
        />
      )}

      {previewUrl && previewDownloadUrl && (
        <DocumentPreviewModal
          url={previewUrl}
          downloadUrl={previewDownloadUrl}
          name={previewName}
          onClose={() => {
            setPreviewUrl(null)
            setPreviewDownloadUrl(null)
            setPreviewName('')
          }}
        />
      )}
    </div>
  )
}

/* ── Schedule Interview Modal ────────────────────────────── */

function ScheduleInterviewModal({
  roundName,
  onClose,
  onSubmit,
  onSkip,
}: {
  roundName: string
  onClose: () => void
  onSubmit: (details: InterviewDetails) => void
  onSkip: () => void
}) {
  useScrollLock()

  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [mode, setMode] = useState<'online' | 'in-person'>('online')
  const [locationOrLink, setLocationOrLink] = useState('')

  const isValid = date && time && locationOrLink.trim()

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <h3>Schedule Interview</h3>
          <button aria-label="Close" className="modal-close" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        <p className="cp-muted" style={{ marginBottom: '16px' }}>
          Schedule an interview or skip directly to accepting the applicant.
        </p>
        
        <div style={{ display: 'grid', gap: '12px', marginBottom: '24px' }}>
          <div className="cp-modal-label">
            Round Name
            <div style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '4px', width: '100%', background: 'var(--bg-subtle)', color: 'var(--text-light)' }}>
              {roundName}
            </div>
          </div>
          <label className="cp-modal-label">
            Date *
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '4px', width: '100%' }} />
          </label>
          <label className="cp-modal-label">
            Time *
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '4px', width: '100%' }} />
          </label>
          <div className="cp-modal-label">
            Format *
            <Dropdown
              ariaLabel="Interview format"
              onChange={(v) => setMode(v as InterviewDetails['mode'])}
              options={[
                { value: 'online', label: 'Online' },
                { value: 'in-person', label: 'In-person' },
              ]}
              value={mode}
            />
          </div>
          <label className="cp-modal-label">
            {mode === 'online' ? 'Meeting Link *' : 'Location Address *'}
            <input type="text" placeholder={mode === 'online' ? "https://meet.google.com/..." : "123 Office Bldg, Floor 4"} value={locationOrLink} onChange={(e) => setLocationOrLink(e.target.value)} style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '4px', marginTop: '4px', width: '100%' }} />
          </label>
        </div>

        <div className="cp-modal-footer" style={{ justifyContent: 'space-between' }}>
          <button className="cp-secondary" onClick={onSkip} type="button" style={{ border: '2px solid var(--brand-orange)', color: 'var(--brand-orange-dark)', fontWeight: 'bold' }}>
            Skip & Accept Directly
          </button>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="cp-secondary" onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="cp-primary"
              disabled={!isValid}
              onClick={() => {
                if (isValid) {
                  onSubmit({ roundName, date, time, mode, locationOrLink })
                }
              }}
              type="button"
              style={{ border: 'none', background: 'var(--brand-orange)', color: 'white' }}
            >
              <CheckCircle2 size={13} /> Schedule Interview
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Document Preview Modal ─────────────────────────────────────── */

function DocumentPreviewModal({
  url,
  downloadUrl,
  name,
  onClose,
}: {
  url: string
  downloadUrl: string
  name: string
  onClose: () => void
}) {
  useScrollLock()

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 9999, padding: '2rem' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel" style={{ width: '100%', maxWidth: '1000px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3 style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>{name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <a 
              href={downloadUrl} 
              target="_blank" 
              rel="noreferrer"
              style={{ color: 'var(--brand-orange)', fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Download size={14} /> Download
            </a>
            <button aria-label="Close" className="modal-close" onClick={onClose} type="button">
              <X size={16} />
            </button>
          </div>
        </div>
        <div style={{ flex: 1, marginTop: '16px', background: '#eee', borderRadius: '6px', overflow: 'hidden' }}>
          <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title={name} />
        </div>
      </div>
    </div>
  )
}

/* ── Request Revision with feedback ─────────────────────────── */

function RevisionModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (feedback: string) => void
}) {
  useScrollLock()

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
          <h3>Request Revision</h3>
          <button aria-label="Close" className="modal-close" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        <p className="cp-muted">
          Provide a reason so the applicant knows what to correct or improve in their submission.
        </p>
        <label className="cp-modal-label">
          Reason for revision *
          <textarea
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. The document is blurry, please re-upload a clear scanned copy."
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
            <XCircle size={13} /> Request Revision
          </button>
        </div>
      </div>
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
  useScrollLock()

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
          <h3>Reject</h3>
          <button aria-label="Close" className="modal-close" onClick={onClose} type="button">
            <X size={16} />
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

export function MatchBar({ value }: { value: number | null }) {
  // No skill data on the applicant's profile — show nothing rather than 0%.
  if (value === null) {
    return <span className="cp-match-value cp-muted">—</span>
  }
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

/**
 * Storage paths are timestamped (`{uid}/resume-1784372069279.pdf`), so show the
 * applicant's name instead of the raw key.
 */
function docLabel(path: string, applicant: string, kind: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  return `${applicant} — ${kind}${ext ? `.${ext}` : ''}`
}

/* ── Bulk Actions & Auto Reject ─────────────────────────────────────────── */

function BulkRejectModal({
  count,
  onClose,
  onSubmit,
}: {
  count: number
  onClose: () => void
  onSubmit: (template: string) => void
}) {
  useScrollLock()
  const [feedback, setFeedback] = useState('Thank you for applying. Unfortunately, we have decided to move forward with other candidates at this time.')

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel">
        <h3 style={{ margin: '0 0 16px', color: 'var(--brand-brown)' }}>Reject {count} Applicants</h3>
        <p className="cp-muted" style={{ marginBottom: 16 }}>
          Send a standard rejection message to all {count} selected candidates. 
          Use <code>{'{Applicant Name}'}</code> to automatically insert their name.
        </p>
        <textarea
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Feedback (optional)"
          style={{ width: '100%', minHeight: 100, marginBottom: 16, fontFamily: 'inherit', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
          value={feedback}
        />
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="cp-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="cp-danger" onClick={() => onSubmit(feedback)} type="button">
            Confirm Bulk Rejection
          </button>
        </div>
      </div>
    </div>
  )
}

function AutoRejectModal({
  info,
  onClose,
  onSubmit,
}: {
  info: { listing: CompanyListing; count: number; pendingIds: string[] }
  onClose: () => void
  onSubmit: (template: string) => void
}) {
  useScrollLock()
  const [feedback, setFeedback] = useState('Thank you for your interest in the ' + info.listing.title + ' position. Unfortunately, we have already filled all available slots for this role and are no longer accepting candidates. We wish you the best in your internship search!')

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel">
        <h3 style={{ margin: '0 0 16px', color: 'var(--brand-brown)' }}>Close Hiring</h3>
        <p className="cp-muted" style={{ marginBottom: 16 }}>
          You have successfully filled all <strong>{info.listing.slots} slots</strong> for <strong>{info.listing.title}</strong>.
        </p>
        <p className="cp-muted" style={{ marginBottom: 16 }}>
          By closing hiring, all remaining <strong>{info.count}</strong> Pending applicants for this listing only will be automatically rejected using the feedback below. Interviewed and Accepted applicants will remain unchanged.
        </p>
        <textarea
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Rejection message..."
          style={{ width: '100%', minHeight: 100, marginBottom: 16, fontFamily: 'inherit', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
          value={feedback}
        />
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="cp-secondary" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="cp-danger" onClick={() => onSubmit(feedback)} type="button">
            Reject Pending & Close Hiring
          </button>
        </div>
      </div>
    </div>
  )
}
