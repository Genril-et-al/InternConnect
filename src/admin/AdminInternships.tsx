import { useMemo, useState, useEffect } from 'react'
import { AlertCircle, RefreshCw, Users } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import type { AdminListing, AdminListingStatus } from './adminData'
import { Dropdown } from '../components/Dropdown'

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
        <Dropdown
          ariaLabel="Filter by moderation status"
          onChange={(v) => setFilter(v as 'all' | AdminListingStatus)}
          options={[
            { value: 'all', label: 'All Moderation' },
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
            { value: 'flagged', label: 'Flagged' },
          ]}
          value={filter}
        />
        <Dropdown
          ariaLabel="Filter by work setup"
          onChange={(v) => setSetupFilter(v as 'all' | 'onsite' | 'remote' | 'hybrid')}
          options={[
            { value: 'all', label: 'All Setups' },
            { value: 'onsite', label: 'On-site' },
            { value: 'remote', label: 'Remote' },
            { value: 'hybrid', label: 'Hybrid' },
          ]}
          value={setupFilter}
        />
        <Dropdown
          ariaLabel="Filter by compensation"
          onChange={(v) => setPaidFilter(v as 'all' | 'paid' | 'unpaid')}
          options={[
            { value: 'all', label: 'All Compensation' },
            { value: 'paid', label: 'Paid' },
            { value: 'unpaid', label: 'Unpaid' },
          ]}
          value={paidFilter}
        />
        <Dropdown
          ariaLabel="Filter by schedule"
          onChange={(v) => setScheduleFilter(v as 'all' | 'part-time' | 'full-time')}
          options={[
            { value: 'all', label: 'All Schedules' },
            { value: 'part-time', label: 'Part-time' },
            { value: 'full-time', label: 'Full-time' },
          ]}
          value={scheduleFilter}
        />
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
