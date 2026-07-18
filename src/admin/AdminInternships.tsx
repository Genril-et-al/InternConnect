import { useMemo, useState } from 'react'
import { AlertCircle, RefreshCw, Users } from 'lucide-react'
import { AdBadge, AdSearch } from './components'
import type { AdminListing, AdminListingStatus } from './adminData'

/** UC-A04 — Oversee internship listings platform-wide (flag / unflag). */
export function AdminInternships({
  listings,
  onSetFlagged,
}: {
  listings: AdminListing[]
  onSetFlagged: (id: string, flagged: boolean) => Promise<void>
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | AdminListingStatus>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = useMemo(
    () =>
      listings.filter(
        (l) =>
          (filter === 'all' || l.status === filter) &&
          (l.title.toLowerCase().includes(search.toLowerCase()) ||
            l.company.toLowerCase().includes(search.toLowerCase())),
      ),
    [listings, search, filter],
  )

  const setFlagged = (id: string, flagged: boolean) => {
    setActionError(null)
    onSetFlagged(id, flagged).catch((err) =>
      setActionError(err instanceof Error ? err.message : 'Action failed.'),
    )
  }

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div>
          <h1 className="ad-title">Manage Internships</h1>
          <p className="ad-subtitle">{listings.length} total listings</p>
        </div>
      </div>

      <div className="ad-toolbar">
        <AdSearch onChange={setSearch} placeholder="Search by title or company…" value={search} />
        <select
          className="ad-select"
          onChange={(e) => setFilter(e.target.value as 'all' | AdminListingStatus)}
          value={filter}
        >
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="flagged">Flagged</option>
        </select>
      </div>

      {actionError && <div className="ad-card ad-empty">{actionError}</div>}

      <div className="ad-rows">
        {filtered.length === 0 ? (
          <div className="ad-card ad-empty">No listings found</div>
        ) : (
          filtered.map((l) => {
            const isExpanded = expandedId === l.id
            return (
              <div
                className={`ad-row ${isExpanded ? 'expanded' : ''}`}
                key={l.id}
                onClick={() => setExpandedId(isExpanded ? null : l.id)}
                style={{
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  padding: 0,
                  cursor: 'pointer',
                }}
              >
                <div className="ad-row-header">
                  <div>
                    <div className="ad-row-title">
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
                    <p className="ad-muted">
                      {l.company} · {l.applicants} applicants · Posted {l.posted} · Deadline{' '}
                      {l.deadline}
                    </p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    {l.status === 'open' && (
                      <button
                        className="ad-secondary"
                        onClick={() => setFlagged(l.id, true)}
                        type="button"
                      >
                        <AlertCircle size={12} /> Flag
                      </button>
                    )}
                    {l.status === 'flagged' && (
                      <button
                        className="ad-secondary"
                        onClick={() => setFlagged(l.id, false)}
                        type="button"
                      >
                        <RefreshCw size={12} /> Unflag
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="ad-row-details" onClick={(e) => e.stopPropagation()}>
                    <div className="ad-details-content">
                      <div className="ad-details-section">
                        <h4 className="ad-details-heading">About Internship</h4>
                        <p className="ad-details-description">
                          {l.description || 'No internship description available.'}
                        </p>
                      </div>
                      <div className="ad-details-stat-card">
                        <div className="ad-stat-icon-wrapper">
                          <Users size={18} />
                        </div>
                        <div>
                          <div className="ad-stat-card-value">{l.applicants}</div>
                          <div className="ad-stat-card-label">Applicants</div>
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
