import { useMemo, useState, useEffect } from 'react'
import { AlertCircle, RefreshCw, Users } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import type { AdminListing, AdminListingStatus } from './adminData'

/** UC-A04 — Oversee internship listings platform-wide (flag / unflag). */
export function AdminInternships({
  listings,
  onSetFlagged,
  highlightedListingId,
}: {
  listings: AdminListing[]
  onSetFlagged: (id: string, flagged: boolean) => Promise<void>
  highlightedListingId?: string | null
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | AdminListingStatus>('all')
  const [setupFilter, setSetupFilter] = useState<'all' | 'onsite' | 'remote' | 'hybrid'>('all')
  const [paidFilter, setPaidFilter] = useState<'all' | 'paid' | 'unpaid'>('all')
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'part-time' | 'full-time'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (highlightedListingId) {
      setTimeout(() => {
        const el = document.querySelector('.ic-row.highlighted')
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
    }
  }, [highlightedListingId])

  const filtered = useMemo(
    () =>
      listings.filter(
        (l) =>
          (filter === 'all' || l.status === filter) &&
          (setupFilter === 'all' || l.setup === setupFilter) &&
          (paidFilter === 'all' || (paidFilter === 'paid' ? l.isPaid : !l.isPaid)) &&
          (scheduleFilter === 'all' || (scheduleFilter === 'full-time' ? l.isFullTime : !l.isFullTime)) &&
          (l.title.toLowerCase().includes(search.toLowerCase()) ||
            l.company.toLowerCase().includes(search.toLowerCase())),
      ),
    [listings, search, filter, setupFilter, paidFilter, scheduleFilter],
  )

  const setFlagged = (id: string, flagged: boolean) => {
    setActionError(null)
    onSetFlagged(id, flagged).catch((err) =>
      setActionError(err instanceof Error ? err.message : 'Action failed.'),
    )
  }

  return (
    <div className="ic-page">
      <div className="ic-page-head">
        <div>
          <h1 className="ic-title">Manage Internships</h1>
          <p className="ic-subtitle">{listings.length} total listings</p>
        </div>
      </div>

      <div className="ic-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <AdSearch onChange={setSearch} placeholder="Search by title or company…" value={search} />
        <select
          className="ic-select"
          onChange={(e) => setFilter(e.target.value as 'all' | AdminListingStatus)}
          value={filter}
        >
          <option value="all">All Moderation</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="flagged">Flagged</option>
        </select>
        <select
          className="ic-select"
          onChange={(e) => setSetupFilter(e.target.value as 'all' | 'onsite' | 'remote' | 'hybrid')}
          value={setupFilter}
        >
          <option value="all">All Setups</option>
          <option value="onsite">On-site</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <select
          className="ic-select"
          onChange={(e) => setPaidFilter(e.target.value as 'all' | 'paid' | 'unpaid')}
          value={paidFilter}
        >
          <option value="all">All Compensation</option>
          <option value="paid">Paid</option>
          <option value="unpaid">Unpaid</option>
        </select>
        <select
          className="ic-select"
          onChange={(e) => setScheduleFilter(e.target.value as 'all' | 'part-time' | 'full-time')}
          value={scheduleFilter}
        >
          <option value="all">All Schedules</option>
          <option value="part-time">Part-time</option>
          <option value="full-time">Full-time</option>
        </select>
      </div>

      {actionError && <div className="ic-card ic-empty">{actionError}</div>}

      <div className="ic-rows">
        {filtered.length === 0 ? (
          <div className="ic-card ic-empty">No listings found</div>
        ) : (
          filtered.map((l) => {
            const isExpanded = expandedId === l.id
            return (
              <div
                className={`ic-row ${isExpanded ? 'expanded' : ''} ${l.id === highlightedListingId ? 'highlighted' : ''}`}
                key={l.id}
                onClick={() => setExpandedId(isExpanded ? null : l.id)}
                style={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <div className="ic-row-header">
                  <div>
                    <div className="ic-row-title">
                      <p>{l.title}</p>
                      <AdBadge
                        text={l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                        variant={
                          l.status === 'open'
                            ? 'success'
                            : l.status === 'flagged'
                              ? 'rejected'
                              : 'neutral'
                        }
                      />
                    </div>
                    <p className="ic-muted">
                      {l.company} · {l.applicants} applicants · Posted {l.posted} · Deadline{' '}
                      {l.deadline}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {l.status === 'open' && (
                      <button
                        className="ic-secondary"
                        onClick={() => setFlagged(l.id, true)}
                        type="button"
                      >
                        <AlertCircle size={12} /> Flag
                      </button>
                    )}
                    {l.status === 'flagged' && (
                      <button
                        className="ic-secondary"
                        onClick={() => setFlagged(l.id, false)}
                        type="button"
                      >
                        <RefreshCw size={12} /> Unflag
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="ic-row-details" onClick={(e) => e.stopPropagation()}>
                    <div className="ic-details-content">
                      <div className="ic-details-section">
                        <h4 className="ic-details-heading">About Internship</h4>
                        <p className="ic-details-description">
                          {l.description || 'No internship description available.'}
                        </p>
                      </div>
                      <div className="ic-details-stat-card">
                        <div className="ic-stat-icon-wrapper">
                          <Users size={18} />
                        </div>
                        <div>
                          <div className="ic-stat-card-value">{l.applicants}</div>
                          <div className="ic-stat-card-label">Applicants</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
